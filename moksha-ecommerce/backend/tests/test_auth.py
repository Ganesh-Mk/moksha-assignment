"""Phase 2: sign-in, token handling, and role assignment.

Route-level authorization (403 on admin routes, 404 on someone else's order) lives in
`test_authz.py`. This file covers how identity is established in the first place.
"""

from __future__ import annotations

from datetime import timedelta

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import auth as auth_router
from app.config import settings
from app.core.security import create_token
from app.models import User, UserRole
from tests.fakes import FakeGoogleVerifier

SIGN_IN = "/api/v1/auth/google"


class TestGoogleSignIn:
    async def test_first_sign_in_creates_the_account(
        self, client: AsyncClient, google: FakeGoogleVerifier, db: AsyncSession
    ) -> None:
        token = google.register(email="newcomer@example.test", name="New Comer")

        response = await client.post(SIGN_IN, json={"id_token": token})

        assert response.status_code == 200
        body = response.json()
        assert body["user"]["email"] == "newcomer@example.test"
        assert body["user"]["role"] == "customer"
        assert body["access_token"] and body["refresh_token"]

        user = (
            await db.execute(select(User).where(User.email == "newcomer@example.test"))
        ).scalar_one()
        assert user.google_sub == "google-sub-newcomer@example.test"

    async def test_second_sign_in_reuses_the_same_account(
        self, client: AsyncClient, google: FakeGoogleVerifier, db: AsyncSession
    ) -> None:
        token = google.register(email="returning@example.test")

        first = await client.post(SIGN_IN, json={"id_token": token})
        second = await client.post(SIGN_IN, json={"id_token": token})

        assert first.json()["user"]["id"] == second.json()["user"]["id"]
        count = len((await db.execute(select(User))).scalars().all())
        assert count == 1

    async def test_an_unverifiable_token_is_rejected(self, client: AsyncClient) -> None:
        """A token the verifier does not accept must not sign anyone in.

        In production this is a bad RS256 signature. The critical failure being guarded against
        is decode-without-verify: anyone can mint a JWT claiming any email, including one on the
        admin allowlist.
        """
        response = await client.post(SIGN_IN, json={"id_token": "forged.token.value"})

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "unauthenticated"

    async def test_an_unverified_google_email_is_rejected(
        self, client: AsyncClient, google: FakeGoogleVerifier
    ) -> None:
        """The admin allowlist is keyed on email, so an unverified address cannot be trusted."""
        token = google.register(email="unverified@example.test", email_verified=False)

        response = await client.post(SIGN_IN, json={"id_token": token})

        assert response.status_code == 401

    async def test_a_disabled_account_cannot_sign_in(
        self, client: AsyncClient, google: FakeGoogleVerifier, db: AsyncSession
    ) -> None:
        token = google.register(email="banned@example.test")
        await client.post(SIGN_IN, json={"id_token": token})
        user = (
            await db.execute(select(User).where(User.email == "banned@example.test"))
        ).scalar_one()
        user.is_active = False
        await db.commit()

        response = await client.post(SIGN_IN, json={"id_token": token})

        assert response.status_code == 401

    async def test_the_seeded_demo_account_adopts_its_real_google_identity(
        self, client: AsyncClient, google: FakeGoogleVerifier, db: AsyncSession
    ) -> None:
        """Lookup falls back to email so a seeded row is claimed, not duplicated.

        The seed writes a placeholder `google_sub`. Without the email fallback, signing in as
        that address would try to insert a second row and hit the unique email index.
        """
        db.add(
            User(
                google_sub="seed-placeholder-0001",
                email="demo.customer@moksha.test",
                name="Demo Customer",
            )
        )
        await db.commit()
        token = google.register(email="demo.customer@moksha.test", sub="real-google-sub-999")

        response = await client.post(SIGN_IN, json={"id_token": token})

        assert response.status_code == 200
        users = (await db.execute(select(User))).scalars().all()
        assert len(users) == 1
        assert users[0].google_sub == "real-google-sub-999"


class TestRoleAssignment:
    async def test_an_allowlisted_email_becomes_an_admin(
        self, client: AsyncClient, google: FakeGoogleVerifier, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "admin_emails_raw", "boss@moksha.test")
        token = google.register(email="boss@moksha.test")

        response = await client.post(SIGN_IN, json={"id_token": token})

        assert response.json()["user"]["role"] == "admin"

    async def test_the_allowlist_is_case_insensitive(
        self, client: AsyncClient, google: FakeGoogleVerifier, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Google returns the address in whatever case the user typed. A case-sensitive allowlist
        # is an allowlist that silently fails.
        monkeypatch.setattr(settings, "admin_emails_raw", "Boss@Moksha.test")
        token = google.register(email="boss@moksha.test")

        response = await client.post(SIGN_IN, json={"id_token": token})

        assert response.json()["user"]["role"] == "admin"

    async def test_a_non_allowlisted_email_is_a_customer(
        self, client: AsyncClient, google: FakeGoogleVerifier, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "admin_emails_raw", "boss@moksha.test")
        token = google.register(email="nobody@moksha.test")

        response = await client.post(SIGN_IN, json={"id_token": token})

        assert response.json()["user"]["role"] == "customer"

    async def test_removing_an_email_from_the_allowlist_demotes_on_next_sign_in(
        self, client: AsyncClient, google: FakeGoogleVerifier, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Role is re-evaluated every sign-in, not granted once and never revisited."""
        token = google.register(email="temp.admin@moksha.test")
        monkeypatch.setattr(settings, "admin_emails_raw", "temp.admin@moksha.test")
        assert (await client.post(SIGN_IN, json={"id_token": token})).json()["user"][
            "role"
        ] == "admin"

        monkeypatch.setattr(settings, "admin_emails_raw", "")

        assert (await client.post(SIGN_IN, json={"id_token": token})).json()["user"][
            "role"
        ] == "customer"


class TestTokenHandling:
    async def test_me_returns_the_signed_in_user(
        self, client: AsyncClient, customer: User, as_customer: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/auth/me", headers=as_customer)

        assert response.status_code == 200
        assert response.json()["email"] == customer.email

    async def test_refresh_issues_a_new_pair(self, client: AsyncClient, customer: User) -> None:
        refresh_token = create_token(
            user_id=customer.id, role=customer.role.value, token_type="refresh"
        )

        response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})

        assert response.status_code == 200
        assert response.json()["access_token"]

    async def test_an_access_token_cannot_be_used_to_refresh(
        self, client: AsyncClient, customer: User
    ) -> None:
        """Token type is checked explicitly.

        Without it, an access token could be swapped for a fresh pair indefinitely and its short
        lifetime would mean nothing.
        """
        access = create_token(user_id=customer.id, role=customer.role.value, token_type="access")

        response = await client.post("/api/v1/auth/refresh", json={"refresh_token": access})

        assert response.status_code == 401

    async def test_a_refresh_token_cannot_be_used_as_an_access_token(
        self, client: AsyncClient, customer: User
    ) -> None:
        refresh = create_token(user_id=customer.id, role=customer.role.value, token_type="refresh")

        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"}
        )

        assert response.status_code == 401

    async def test_refresh_re_reads_the_account_so_a_disabled_user_cannot_renew(
        self, client: AsyncClient, customer: User, db: AsyncSession
    ) -> None:
        """A token asserts something about the past; the database holds the present."""
        refresh = create_token(user_id=customer.id, role=customer.role.value, token_type="refresh")
        user = (await db.execute(select(User).where(User.id == customer.id))).scalar_one()
        user.is_active = False
        await db.commit()

        response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})

        assert response.status_code == 401

    async def test_a_role_change_takes_effect_without_reissuing_the_token(
        self, client: AsyncClient, customer: User, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """The role is read from the database, not from the token claim.

        This is why `get_current_user` pays for a primary-key lookup on every request: a token
        issued an hour ago must not keep granting a privilege that has since been revoked.
        """
        user = (await db.execute(select(User).where(User.id == customer.id))).scalar_one()
        user.role = UserRole.ADMIN
        await db.commit()

        response = await client.get("/api/v1/auth/me", headers=as_customer)

        assert response.json()["role"] == "admin"

    async def test_logout_requires_authentication(self, client: AsyncClient) -> None:
        assert (await client.post("/api/v1/auth/logout")).status_code == 401


class TestTokenForgery:
    """Every one of these is a real forgery attempt against the real verifier."""

    async def test_a_token_signed_with_the_wrong_key_is_rejected(
        self, client: AsyncClient, customer: User
    ) -> None:
        forged = jwt.encode(
            {"sub": str(customer.id), "role": "admin", "type": "access", "exp": 9_999_999_999},
            "not-our-secret",
            algorithm="HS256",
        )

        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"}
        )

        assert response.status_code == 401

    async def test_an_alg_none_token_is_rejected(self, client: AsyncClient, customer: User) -> None:
        """The classic JWT confusion attack.

        `algorithms` is pinned to our configured algorithm rather than read from the token's own
        header, so a token declaring `alg: none` cannot verify against no signature at all.
        """
        unsigned = jwt.encode(
            {"sub": str(customer.id), "role": "admin", "type": "access", "exp": 9_999_999_999},
            key="",
            algorithm="none",
        )

        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {unsigned}"}
        )

        assert response.status_code == 401

    async def test_an_expired_token_is_rejected(self, client: AsyncClient, customer: User) -> None:
        expired = create_token(
            user_id=customer.id,
            role="customer",
            token_type="access",
            expires_delta=timedelta(seconds=-1),
        )

        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"}
        )

        assert response.status_code == 401

    async def test_a_tampered_payload_is_rejected(
        self, client: AsyncClient, customer: User
    ) -> None:
        """Flipping a character in the payload breaks the signature."""
        valid = create_token(user_id=customer.id, role="customer", token_type="access")
        header, payload, signature = valid.split(".")
        tampered = f"{header}.{payload[:-4]}AAAA.{signature}"

        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered}"}
        )

        assert response.status_code == 401

    @pytest.mark.parametrize(
        "header",
        [
            {},
            {"Authorization": ""},
            {"Authorization": "Bearer"},
            {"Authorization": "Bearer "},
            {"Authorization": "not-a-bearer-token"},
            {"Authorization": "Basic dXNlcjpwYXNz"},
            {"Authorization": "Bearer ...."},
        ],
        ids=["missing", "empty", "no-value", "blank", "wrong-scheme", "basic-auth", "garbage"],
    )
    async def test_malformed_authorization_headers_are_rejected(
        self, client: AsyncClient, header: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/auth/me", headers=header)

        assert response.status_code == 401

    async def test_a_token_for_a_deleted_user_is_rejected(self, client: AsyncClient) -> None:
        """Signature valid, subject gone. The database lookup is what catches this."""
        orphan = create_token(user_id=999_999, role="admin", token_type="access")

        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {orphan}"}
        )

        assert response.status_code == 404


DEMO_SIGN_IN = "/api/v1/auth/demo"
DEMO_PASSWORD = "correct-horse-battery-staple"


@pytest.fixture
def demo_login_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Turn the demo door on, and give every test a fresh rate-limit budget.

    The limiter is a module-level singleton — deliberately, since it is process-wide state in
    production too — so without the reset the sixth test in this file would start failing for
    reasons that have nothing to do with what it asserts.
    """
    monkeypatch.setattr(settings, "demo_login_password", DEMO_PASSWORD)
    auth_router._demo_login_limiter._hits.clear()


class TestDemoSignIn:
    """The password-only door that exists so the app can be reviewed.

    What these tests are really pinning down is the claim made in `auth_service`: that this is an
    *authentication* shortcut and not an *authorization* one. Hence the last two tests, which
    check that a demo token is an ordinary token — it opens exactly what its role opens, and
    nothing more.
    """

    async def test_the_endpoint_does_not_exist_when_no_password_is_configured(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """404, not 503.

        503 would be honest about *why* it is unavailable, which is the right answer for a
        misconfigured feature. This one is not misconfigured — it is switched off, and saying
        "this exists but is unavailable" invites someone to come back and look for it.
        """
        monkeypatch.setattr(settings, "demo_login_password", None)

        response = await client.post(DEMO_SIGN_IN, json={"password": DEMO_PASSWORD})

        assert response.status_code == 404

    async def test_the_right_password_signs_in_as_admin(
        self, client: AsyncClient, demo_login_enabled: None
    ) -> None:
        response = await client.post(DEMO_SIGN_IN, json={"password": DEMO_PASSWORD})

        assert response.status_code == 200
        body = response.json()
        assert body["user"]["role"] == "admin"
        assert body["access_token"] and body["refresh_token"]

    async def test_the_role_can_be_asked_for_explicitly(
        self, client: AsyncClient, demo_login_enabled: None
    ) -> None:
        response = await client.post(
            DEMO_SIGN_IN, json={"password": DEMO_PASSWORD, "role": "customer"}
        )

        assert response.status_code == 200
        assert response.json()["user"]["role"] == "customer"

    async def test_a_wrong_password_is_rejected(
        self, client: AsyncClient, demo_login_enabled: None, db: AsyncSession
    ) -> None:
        response = await client.post(DEMO_SIGN_IN, json={"password": "not-the-password"})

        assert response.status_code == 401
        # And it left nothing behind — a failed attempt must not provision the account.
        assert (await db.execute(select(User))).scalars().all() == []

    async def test_signing_in_twice_reuses_one_account(
        self, client: AsyncClient, demo_login_enabled: None, db: AsyncSession
    ) -> None:
        first = await client.post(DEMO_SIGN_IN, json={"password": DEMO_PASSWORD})
        second = await client.post(DEMO_SIGN_IN, json={"password": DEMO_PASSWORD})

        assert first.json()["user"]["id"] == second.json()["user"]["id"]
        assert len((await db.execute(select(User))).scalars().all()) == 1

    async def test_repeated_wrong_guesses_are_rate_limited(
        self, client: AsyncClient, demo_login_enabled: None
    ) -> None:
        """A shared password is weaker than a real credential, so the limit is the real defence."""
        for _ in range(5):
            assert (await client.post(DEMO_SIGN_IN, json={"password": "wrong"})).status_code == 401

        response = await client.post(DEMO_SIGN_IN, json={"password": "wrong"})

        assert response.status_code == 429
        assert response.headers["retry-after"]

    async def test_a_correct_password_clears_the_counter(
        self, client: AsyncClient, demo_login_enabled: None
    ) -> None:
        """Four typos followed by a success must not leave a reviewer one attempt from lockout."""
        for _ in range(4):
            await client.post(DEMO_SIGN_IN, json={"password": "wrong"})

        assert (
            await client.post(DEMO_SIGN_IN, json={"password": DEMO_PASSWORD})
        ).status_code == 200
        assert (await client.post(DEMO_SIGN_IN, json={"password": "wrong"})).status_code == 401

    async def test_the_demo_admin_token_is_an_ordinary_admin_token(
        self, client: AsyncClient, demo_login_enabled: None
    ) -> None:
        """The point of the whole design: nothing downstream treats this token specially."""
        token = (await client.post(DEMO_SIGN_IN, json={"password": DEMO_PASSWORD})).json()[
            "access_token"
        ]

        response = await client.get(
            "/api/v1/admin/orders", headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200

    async def test_the_demo_customer_token_is_still_refused_by_admin_routes(
        self, client: AsyncClient, demo_login_enabled: None
    ) -> None:
        """The inverse, and the more important half: the door does not grant privilege."""
        token = (
            await client.post(DEMO_SIGN_IN, json={"password": DEMO_PASSWORD, "role": "customer"})
        ).json()["access_token"]

        response = await client.get(
            "/api/v1/admin/orders", headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 403
