"""Auth request and response bodies."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import UserRole


class GoogleSignInRequest(BaseModel):
    id_token: str = Field(
        min_length=1,
        max_length=8192,
        description="The `credential` string from Google Identity Services.",
    )


class DemoSignInRequest(BaseModel):
    """Password only — no email, deliberately.

    There is no account to identify: the password selects *which seeded demo account* to sign
    into, and both are fixed. Asking for an email would imply a user directory that this door
    does not have, and would be one more thing for a reviewer to get wrong.
    """

    password: str = Field(min_length=1, max_length=256)
    role: UserRole = UserRole.ADMIN


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=8192)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    picture_url: str | None
    role: UserRole
    created_at: datetime


class TokenResponse(BaseModel):
    """The tokens plus the user, so a sign-in is one round-trip rather than two."""

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = Field(description="Access token lifetime in seconds.")
    user: UserResponse
