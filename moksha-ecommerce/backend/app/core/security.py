"""Token issue and verification — ours, and Google's.

Two separate concerns live here, and they must not be confused:

* **Google's ID token** is an assertion *by Google* about who the user is. We verify its
  signature against Google's public JWKS and then throw it away.
* **Our access token** is an assertion *by us* about what that user may do. It carries the role,
  which Google knows nothing about (DECISIONS D-011).

The Google verifier sits behind a `Protocol` so tests can substitute a fake. That seam exists for
testability — it is what lets the whole authorization suite run with no network and no
credentials — not to support a second identity provider.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Protocol

import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import settings
from app.core.exceptions import AuthenticationError

TokenType = Literal["access", "refresh"]

# Google signs ID tokens with one of these issuers. Anything else is not a Google token, whatever
# it claims about itself.
_GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


@dataclass(frozen=True)
class GoogleIdentity:
    """The claims we take from a *verified* Google ID token. Nothing else is trusted."""

    sub: str
    email: str
    name: str
    picture: str | None
    email_verified: bool


class GoogleTokenVerifier(Protocol):
    """The seam. `verify` either returns a verified identity or raises AuthenticationError."""

    def verify(self, id_token: str) -> GoogleIdentity: ...


class GoogleJwksVerifier:
    """The real verifier: checks the signature against Google's live JWKS.

    `google.oauth2.id_token.verify_oauth2_token` fetches Google's current signing keys, validates
    the RS256 signature, the expiry, and the audience against our client id.

    The alternative — decoding the payload without verifying — is the single most common critical
    bug in this integration, because the token *looks* right in a debugger either way. Anyone can
    mint an unsigned JWT claiming to be any email address, including an address on the admin
    allowlist. There is a test asserting a forged token is rejected.
    """

    def __init__(self, client_id: str) -> None:
        self._client_id = client_id
        self._request = google_requests.Request()

    def verify(self, id_token: str) -> GoogleIdentity:
        try:
            claims: dict[str, Any] = google_id_token.verify_oauth2_token(
                id_token, self._request, self._client_id
            )
        except ValueError as exc:
            # google-auth raises ValueError for every failure mode — bad signature, expired,
            # wrong audience. The reason is logged, not returned: telling a caller *why* their
            # token failed helps them iterate towards one that does not.
            raise AuthenticationError("Google sign-in could not be verified.") from exc

        if claims.get("iss") not in _GOOGLE_ISSUERS:
            raise AuthenticationError("Google sign-in could not be verified.")

        if not claims.get("email"):
            raise AuthenticationError("Google account did not provide an email address.")

        # An unverified email must not be trusted: the admin allowlist is keyed on email, so
        # accepting one would let anyone claim an admin address they do not control.
        if not claims.get("email_verified", False):
            raise AuthenticationError("Your Google email address is not verified.")

        return GoogleIdentity(
            sub=str(claims["sub"]),
            email=str(claims["email"]).lower(),
            name=str(claims.get("name") or claims["email"]),
            picture=claims.get("picture"),
            email_verified=True,
        )


def create_token(
    *,
    user_id: int,
    role: str,
    token_type: TokenType,
    expires_delta: timedelta | None = None,
) -> str:
    """Issue one of our own JWTs.

    `sub` is the user id as a string (the JWT spec requires a string), and `role` is embedded so
    an admin check needs no database round-trip. `jti` gives every token a unique id, which is
    what a revocation list would key on if this grew one.
    """
    now = datetime.now(UTC)
    if expires_delta is None:
        expires_delta = (
            timedelta(minutes=settings.access_token_expire_minutes)
            if token_type == "access"
            else timedelta(days=settings.refresh_token_expire_days)
        )

    payload = {
        "sub": str(user_id),
        "role": role,
        # Distinguishing the two types matters: without it a refresh token — which is long-lived
        # by design — would be accepted as an access token, silently extending every session to
        # the refresh lifetime.
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@dataclass(frozen=True)
class TokenClaims:
    user_id: int
    role: str
    token_type: TokenType
    jti: str


def decode_token(token: str, *, expected_type: TokenType) -> TokenClaims:
    """Verify one of our tokens, or raise AuthenticationError.

    `algorithms` is pinned to our configured algorithm alone. Passing the token's own `alg`
    header back into the decoder is the classic JWT confusion attack: a token with
    `{"alg": "none"}` would otherwise verify against no signature at all.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Your session has expired. Please sign in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid authentication token.") from exc

    if payload.get("type") != expected_type:
        raise AuthenticationError("Invalid authentication token.")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise AuthenticationError("Invalid authentication token.") from exc

    return TokenClaims(
        user_id=user_id,
        role=str(payload.get("role", "customer")),
        token_type=expected_type,
        jti=str(payload.get("jti", "")),
    )
