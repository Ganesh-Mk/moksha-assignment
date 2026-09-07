"""Shared test fixtures.

Two deliberate choices here, both driven by what the headline tests need:

**The suite runs against real PostgreSQL, not SQLite.** The oversell test exercises
`SELECT … FOR UPDATE`, which SQLite does not implement — on SQLite it would silently pass while
proving nothing. It runs against a *separate* database (`moksha_test`) so a test run can never
touch the demo data.

**Tables are truncated between tests rather than wrapped in a rolled-back transaction.** The
transaction-per-test trick is faster, but it forces every test to share one connection, and the
concurrency test needs two genuinely independent transactions racing each other. Truncation costs
a few milliseconds and keeps that test honest.

The suite requires **no API credentials**. Google, Stripe and Anthropic are each reached through a
seam that tests replace with a fake — see `tests/fakes.py`.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

# Must precede any app import: config reads the environment at import time, and psycopg's async
# mode cannot run on Windows' default event loop.
os.environ.setdefault("ENVIRONMENT", "test")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.core.deps import get_google_verifier
from app.core.platform import apply_windows_event_loop_policy
from app.core.security import create_token
from app.database import _async_url, get_db
from app.main import create_app
from app.models import Base, User, UserRole
from tests.fakes import FakeGoogleVerifier

apply_windows_event_loop_policy()


def _test_database_url() -> str:
    if not settings.test_database_url:
        raise RuntimeError(
            "TEST_DATABASE_URL is not set. The suite needs a real PostgreSQL database "
            "(SQLite cannot do SELECT ... FOR UPDATE). Start one with "
            "`docker compose up -d db` or `./scripts/pg-local.ps1 init`, then set "
            "TEST_DATABASE_URL in backend/.env.local."
        )
    return _async_url(settings.test_database_url)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
async def engine() -> AsyncGenerator[object, None]:
    eng = create_async_engine(_test_database_url(), poolclass=None)
    async with eng.begin() as conn:
        # Dropping first makes the suite reproducible after a schema change without anyone
        # having to remember to reset the test database by hand.
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture(scope="session")
def sessionmaker_(engine: object) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)  # type: ignore[arg-type]


@pytest.fixture(autouse=True)
async def _clean_tables(engine: object) -> AsyncGenerator[None, None]:
    """Empty every table before each test.

    RESTART IDENTITY keeps generated ids predictable across tests, which matters for the
    ownership tests — they assert on "order 1 belongs to user A", and drifting sequences would
    make those assertions accidental rather than deliberate.
    """
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    if tables:
        async with engine.begin() as conn:  # type: ignore[attr-defined]
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
async def db(sessionmaker_: async_sessionmaker[AsyncSession]) -> AsyncGenerator[AsyncSession, None]:
    """A session for arranging fixtures and asserting on state directly."""
    async with sessionmaker_() as session:
        yield session


@pytest.fixture
def google() -> FakeGoogleVerifier:
    """The Google verification double. Register an email, get a token that verifies."""
    return FakeGoogleVerifier()


@pytest.fixture
async def client(
    sessionmaker_: async_sessionmaker[AsyncSession],
    google: FakeGoogleVerifier,
) -> AsyncGenerator[AsyncClient, None]:
    """An HTTP client bound to the app in-process — no live server, no network.

    Requests go through the real middleware, routers, dependencies and exception handlers, so an
    authz test here exercises the same code path production uses. Only the Google network call
    is replaced, at the seam the application already has.
    """
    app = create_app()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with sessionmaker_() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_google_verifier] = lambda: google

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# --- Identity fixtures ------------------------------------------------------------------
#
# Tokens here are REAL, signed with the app's own key by the app's own `create_token`. Only
# Google's verification is faked. An authz test that used a fake token would be testing the
# fake, not the guard.


async def _make_user(
    sessionmaker_: async_sessionmaker[AsyncSession],
    *,
    email: str,
    role: UserRole,
    is_active: bool = True,
) -> User:
    async with sessionmaker_() as session:
        user = User(
            google_sub=f"sub-{email}",
            email=email,
            name=email.split("@")[0].title(),
            role=role,
            is_active=is_active,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest.fixture
async def customer(sessionmaker_: async_sessionmaker[AsyncSession]) -> User:
    return await _make_user(sessionmaker_, email="customer@moksha.test", role=UserRole.CUSTOMER)


@pytest.fixture
async def other_customer(sessionmaker_: async_sessionmaker[AsyncSession]) -> User:
    """A second customer. Every ownership test needs someone to *not* be."""
    return await _make_user(sessionmaker_, email="other@moksha.test", role=UserRole.CUSTOMER)


@pytest.fixture
async def admin(sessionmaker_: async_sessionmaker[AsyncSession]) -> User:
    return await _make_user(sessionmaker_, email="admin@moksha.test", role=UserRole.ADMIN)


def auth_header(user: User) -> dict[str, str]:
    token = create_token(user_id=user.id, role=user.role.value, token_type="access")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def as_customer(customer: User) -> dict[str, str]:
    return auth_header(customer)


@pytest.fixture
def as_other_customer(other_customer: User) -> dict[str, str]:
    return auth_header(other_customer)


@pytest.fixture
def as_admin(admin: User) -> dict[str, str]:
    return auth_header(admin)
