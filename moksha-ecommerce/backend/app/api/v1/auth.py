"""Authentication endpoints.

Router responsibilities only: authenticate, validate, delegate, serialize. The sign-in rules live
in `services/auth_service.py`.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession, GoogleVerifier
from app.core.security import decode_token
from app.schemas.auth import (
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
