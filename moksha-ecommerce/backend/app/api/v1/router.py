"""v1 router aggregation.

Routers are mounted here and nowhere else, so `main.py` has one line for the whole API surface
and the auth posture of every route group is visible on one screen.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()

# Public — no credentials required.
api_router.include_router(health.router)
