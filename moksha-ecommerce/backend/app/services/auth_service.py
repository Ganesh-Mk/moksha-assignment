"""Sign-in, account provisioning, and role assignment.

Business logic only — no HTTP, no `HTTPException`. See DECISIONS D-003.
"""

from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.logging import get_logger
from app.core.security import GoogleIdentity, GoogleTokenVerifier, create_token
from app.models import User, UserRole

logger = get_logger(__name__)


def role_for(email: str) -> UserRole:
    """Admin if the address is on the allowlist, customer otherwise.

    An env-var allowlist rather than a database flag, deliberately: it means privilege cannot be
    escalated by writing to the database, only by changing deployment configuration. For an
    assignment-sized app that is the right trade — a real one would grow an admin invitation flow,
    and this is the seam it would replace.
    """
    return UserRole.ADMIN if email.lower() in settings.admin_emails else UserRole.CUSTOMER


async def find_or_create_user(session: AsyncSession, identity: GoogleIdentity) -> User:
    """Resolve a verified Google identity to a user row, creating one on first sign-in.

    Lookup is by `google_sub` first and email second. `sub` is Google's stable identifier and
    never changes; email can. Falling back to email is what lets the *seeded* demo accounts adopt
    their real Google identity on first sign-in instead of colliding on the unique email index.
    """
    user = (
        await session.execute(select(User).where(User.google_sub == identity.sub))
    ).scalar_one_or_none()

    if user is None:
        user = (
            await session.execute(select(User).where(User.email == identity.email))
        ).scalar_one_or_none()
        if user is not None:
            user.google_sub = identity.sub

    if user is None:
        user = User(
            google_sub=identity.sub,
            email=identity.email,
            name=identity.name,
            picture_url=identity.picture,
            role=role_for(identity.email),
            # Set explicitly rather than leaning on the column default: that default is applied
            # at flush, so the `is_active` check below would read None on a brand-new user.
            is_active=True,
        )
        session.add(user)
        logger.info("user_registered", extra={"email": identity.email, "role": user.role.value})
    else:
        # Profile fields are refreshed from Google on every sign-in — it is the authority on the
        # user's name and avatar, and a stale avatar is a visible bug.
        user.name = identity.name
        user.picture_url = identity.picture
        user.email = identity.email
        # Re-evaluated each sign-in so removing an address from ADMIN_EMAILS actually demotes
        # that user, rather than leaving a role granted once and never revisited.
        user.role = role_for(identity.email)

    if not user.is_active:
        # Checked after the upsert so a disabled account still has its profile kept current,
        # and so re-enabling it needs no repair step.
        raise AuthenticationError("This account has been disabled.")

    await session.commit()
    await session.refresh(user)
    return user


class TokenPair:
    __slots__ = ("access_token", "expires_in", "refresh_token")

    def __init__(self, access_token: str, refresh_token: str, expires_in: int) -> None:
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_in = expires_in


def issue_tokens(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_token(user_id=user.id, role=user.role.value, token_type="access"),
        refresh_token=create_token(user_id=user.id, role=user.role.value, token_type="refresh"),
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def sign_in_with_google(
    session: AsyncSession, *, id_token: str, verifier: GoogleTokenVerifier
) -> tuple[User, TokenPair]:
    """The whole sign-in flow: verify Google's assertion, provision, issue our own tokens."""
    identity = verifier.verify(id_token)
    user = await find_or_create_user(session, identity)
    logger.info("user_signed_in", extra={"user_id": user.id, "role": user.role.value})
    return user, issue_tokens(user)


# The seeded accounts the demo password signs into. Emails on a `.test` TLD (RFC 2606) so they
# can never collide with a real Google identity, and so nobody mistakes them for a live mailbox.
DEMO_ACCOUNTS: dict[UserRole, tuple[str, str]] = {
    UserRole.ADMIN: ("demo.admin@moksha.test", "Demo Admin"),
    UserRole.CUSTOMER: ("demo.customer@moksha.test", "Demo Customer"),
}


async def sign_in_with_demo_password(
    session: AsyncSession, *, password: str, role: UserRole
) -> tuple[User, TokenPair]:
    """Sign in to a seeded demo account with a shared password.

    **This is an authentication shortcut, not an authorization bypass**, and the distinction is
    the whole design. It issues exactly the same JWT `sign_in_with_google` does, for a real user
    row with a real role. Every downstream check — `require_admin`, order ownership, the agent's
    identity scoping — is untouched and still applies. Nothing anywhere reads "did you come in
    through the demo door".

    Why it exists: the Google consent screen is in Testing mode, so only allow-listed Google
    accounts can sign in. A reviewer cannot authenticate at all, which leaves them the public
    catalogue and nothing else — no checkout, no order history, no AI agent, no admin. The
    assignment is largely unreviewable without this.

    What keeps it honest:

    * **Off unless configured.** No `DEMO_LOGIN_PASSWORD`, no endpoint. Opt-in per deployment.
    * **Constant-time comparison.** `==` on secrets leaks length and prefix through timing;
      `compare_digest` does not. Cheap, and the habit is what matters.
    * **Rate limited per client**, in the router — a password endpoint without one is a
      brute-force target, and this password is necessarily weaker than a real credential.
    * **It cannot reach anything a Google sign-in could not.** The accounts are ordinary rows.
    """
    expected = settings.require_demo_login()

    # compare_digest needs bytes or ASCII str; encode so a non-ASCII password cannot raise.
    if not secrets.compare_digest(password.encode("utf-8"), expected.encode("utf-8")):
        logger.warning("demo_login_rejected", extra={"role": role.value})
        raise AuthenticationError("That password is not correct.")

    email, name = DEMO_ACCOUNTS[role]
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()

    if user is None:
        # Created on demand so the demo works on a database that was migrated but never seeded.
        user = User(
            google_sub=f"demo-login-{role.value}",
            email=email,
            name=name,
            role=role,
            is_active=True,
        )
        session.add(user)
    else:
        # Re-asserted on every sign-in: the seeded row's role is whatever ADMIN_EMAILS made it
        # last time a Google sign-in touched it, and the demo admin must actually be an admin.
        user.role = role
        user.is_active = True

    await session.commit()
    await session.refresh(user)

    logger.info("demo_login", extra={"user_id": user.id, "role": user.role.value})
    return user, issue_tokens(user)


async def get_user(session: AsyncSession, user_id: int) -> User:
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found.")
    return user


async def refresh_tokens(session: AsyncSession, user_id: int) -> tuple[User, TokenPair]:
    """Exchange a valid refresh token for a new pair.

    The user is re-read from the database rather than trusted from the token, so an account
    disabled or demoted since the refresh token was issued cannot renew its access. A token
    carries a claim about the past; the database holds the present.
    """
    user = await get_user(session, user_id)
    if not user.is_active:
        raise AuthenticationError("This account has been disabled.")
    return user, issue_tokens(user)
