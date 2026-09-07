"""v1 router aggregation.

Routers are mounted here and nowhere else, so `main.py` has one line for the whole API surface
and the auth posture of every route group is visible on one screen.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, health

api_router = APIRouter()

# Public — no credentials required.
api_router.include_router(health.router)

# Mixed: sign-in and refresh are public (the token is the credential); /me and /logout require
# an access token. Declared per-route, never by default.
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
