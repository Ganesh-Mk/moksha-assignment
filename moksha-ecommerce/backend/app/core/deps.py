"""Authentication and authorization dependencies.

**This module is the security boundary.** Every protected endpoint in the API declares one of
these, and nothing else grants access. The brief states it as its own emphasized line:

> "The backend must enforce authorization. Do not rely only on frontend restrictions."

Hiding the admin link in the navigation is UX. This file is the security control. A route with no
dependency from here is public — which is why every router states its posture explicitly rather
than relying on a default.

Three levels, and no fourth:

| Dependency           | Requirement                          | Failure |
|----------------------|--------------------------------------|---------|
| *(none)*             | public                               | —       |
| `CurrentUser`        | valid access token, active account   | 401     |
| `AdminUser`          | the above, plus `role == admin`      | 403     |
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AuthenticationError, ForbiddenError
from app.core.logging import set_log_user
from app.core.security import GoogleJwksVerifier, GoogleTokenVerifier, decode_token
from app.database import get_db
from app.models import User, UserRole
from app.services import auth_service

# auto_error=False so a missing header raises our own AuthenticationError with a consistent body,
# rather than FastAPI's differently-shaped 403.
_bearer = HTTPBearer(auto_error=False, description="Access token from POST /auth/google")


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Resolve the caller from a verified access token, or raise 401.

    The user is loaded from the database on every request rather than reconstructed from token
    claims. That costs one indexed primary-key lookup and buys immediate revocation: an account
    disabled a second ago cannot keep acting on an access token that is still within its hour.
    """
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Sign in to continue.")

    claims = decode_token(credentials.credentials, expected_type="access")
    user = await auth_service.get_user(session, claims.user_id)

    if not user.is_active:
        raise AuthenticationError("This account has been disabled.")

    # Attach the caller to every subsequent log line in this request, so a report of "my checkout
    # failed" resolves to one user's full trace.
    set_log_user(user.id)
    request.state.user = user
    return user


async def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    """403 for a signed-in non-admin.

    403 rather than 404 here, deliberately, and the opposite of the rule for orders: the
    *existence* of an admin API is not a secret — it is in the public OpenAPI document. What
    matters is that the caller is refused. For another customer's order, existence *is* the
    secret, so that path returns 404 instead (DECISIONS D-007).
    """
    if user.role is not UserRole.ADMIN:
        raise ForbiddenError("This action requires an administrator account.")
    return user


async def get_optional_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """For endpoints that are public but richer when signed in.

    A bad token is still rejected. Silently treating a malformed token as "anonymous" would hide
    an expired session behind a page that merely looks logged out.
    """
    if credentials is None or not credentials.credentials:
        return None
    return await get_current_user(request, credentials, session)


def get_google_verifier() -> GoogleTokenVerifier:
    """The Google verification seam.

    Overridden in tests with a fake, which is what lets the entire authorization suite run with
    no network access and no credentials. In production this constructs the real JWKS verifier,
    and `require_google()` raises a 503 naming GOOGLE_CLIENT_ID if it is not configured — it
    never falls back to an unverified decode.
    """
    return GoogleJwksVerifier(settings.require_google())


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
GoogleVerifier = Annotated[GoogleTokenVerifier, Depends(get_google_verifier)]
