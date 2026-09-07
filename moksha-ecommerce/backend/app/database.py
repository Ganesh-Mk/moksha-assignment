"""Async engine and the per-request session dependency."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings


def _async_url(url: str) -> str:
    """Normalise a DSN to psycopg 3's async-capable dialect.

    Managed Postgres providers hand out `postgres://` or `postgresql://` URLs. SQLAlchemy needs
    the driver named explicitly, and psycopg 3 is the one driver we use for both the async app
    and sync Alembic (D-001), so any bare form is rewritten rather than rejected.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


engine: AsyncEngine = create_async_engine(
    _async_url(settings.database_url),
    echo=False,
    # pool_pre_ping costs one round-trip per checkout and saves the "server closed the connection
    # unexpectedly" error that managed Postgres produces after an idle timeout.
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=5,
)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,  # keeps ORM objects readable after commit, so routers can serialize
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one session per request, rolled back on any unhandled error.

    Services own their own commits — a service is the unit of business work, so it decides when
    that work is durable. This dependency only guarantees the session is closed and that a
    failed request never leaves a half-applied transaction open.
    """
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
