"""Authentication endpoints.

Router responsibilities only: authenticate, validate, delegate, serialize. The sign-in rules live
in `services/auth_service.py`.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.config import settings
from app.core.deps import CurrentUser, DbSession, GoogleVerifier
from app.core.exceptions import NotFoundError
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.security import decode_token
from app.schemas.auth import (
    DemoSignInRequest,
    GoogleSignInRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter()


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in with Google",
    description=(
        "**Public.** Exchanges a Google ID token for our own access and refresh tokens.\n\n"
        "The ID token's signature is verified against Google's live JWKS before anything else "
        "happens — it is never decoded without verification. The user is created on first "
        "sign-in and matched on Google's stable `sub` thereafter.\n\n"
        "Returns **401** if the token fails verification, is expired, was issued for a different "
        "client id, or carries an unverified email address."
    ),
)
async def sign_in_with_google(
    payload: GoogleSignInRequest,
    session: DbSession,
    verifier: GoogleVerifier,
) -> TokenResponse:
    user, tokens = await auth_service.sign_in_with_google(
        session, id_token=payload.id_token, verifier=verifier
    )
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=UserResponse.model_validate(user),
    )


# Five attempts a minute per client address. A password endpoint without a limit is a
# brute-force target, and this password is necessarily weaker and more widely shared than a real
# credential. Deliberately much tighter than the chat limit, which is about cost rather than
# security.
_demo_login_limiter = SlidingWindowRateLimiter(limit=5, window_seconds=60, label="demo-login")


@router.post(
    "/demo",
    response_model=TokenResponse,
    summary="Sign in to a demo account with a shared password",
    description=(
        "**Public, and only exists when `DEMO_LOGIN_PASSWORD` is set** — otherwise this endpoint "
        "returns **404**, so it is opt-in per deployment.\n\n"
        "It exists for *reviewability*. The Google consent screen is in Testing mode, so only "
        "allow-listed Google accounts can sign in at all; without this a reviewer gets the public "
        "catalogue and nothing else — no checkout, no orders, no AI agent, no admin.\n\n"
        "**This is an authentication shortcut, not an authorization bypass.** It issues exactly "
        "the same JWT as Google sign-in, for a real user row with a real role. `require_admin`, "
        "order ownership and the agent's identity scoping are all unchanged and still apply — "
        "nothing downstream knows or cares which door you came through.\n\n"
        "The password is compared in constant time and the endpoint is rate limited to 5 attempts "
        "a minute per client. Returns **401** for a wrong password, **429** when limited."
    ),
)
async def sign_in_with_demo_password(
    payload: DemoSignInRequest, request: Request, session: DbSession
) -> TokenResponse:
    if not settings.demo_login_enabled:
        # 404 rather than 503: when the door does not exist, saying so invites someone to go
        # looking for it. An unconfigured *feature* is a 503; an absent one is a 404.
        raise NotFoundError("Not found.")

    # Keyed on the client address rather than the password, so guessing many passwords from one
    # place is what gets throttled.
    client = request.client.host if request.client else "unknown"
    _demo_login_limiter.check(client, message="Too many sign-in attempts. Please wait a minute.")

    user, tokens = await auth_service.sign_in_with_demo_password(
        session, password=payload.password, role=payload.role
    )
    # A correct password clears the counter, so a few typos never lock out a real reviewer.
    _demo_login_limiter.reset(client)

    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange a refresh token for a new access token",
    description=(
        "**Public** (the refresh token is the credential).\n\n"
        "The token type is checked explicitly: an *access* token presented here is rejected. "
        "Without that check, a short-lived access token would be swapped for a fresh pair "
        "indefinitely, and the access lifetime would mean nothing.\n\n"
        "The account is re-read from the database, so one disabled or demoted since the refresh "
        "token was issued cannot renew."
    ),
)
async def refresh(payload: RefreshRequest, session: DbSession) -> TokenResponse:
    claims = decode_token(payload.refresh_token, expected_type="refresh")
    user, tokens = await auth_service.refresh_tokens(session, claims.user_id)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="The signed-in user",
    description="**Authenticated.** Used by the frontend to restore a session on page load.",
)
async def me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out",
    description=(
        "**Authenticated.** The client discards both tokens.\n\n"
        "This endpoint is honest about what it does *not* do: with stateless JWTs, an already-"
        "issued access token stays valid until it expires. Real revocation needs a denylist of "
        "`jti` values in Redis checked on every request — a deliberate trade documented in "
        "`docs/DECISIONS.md`, not an oversight. The short access lifetime bounds the exposure, "
        "and it exists as an endpoint so the audit log records the intent."
    ),
)
async def logout(user: CurrentUser) -> None:
    return None
