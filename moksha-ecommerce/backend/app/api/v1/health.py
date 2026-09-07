"""Liveness and readiness probes.

Two endpoints, because they answer different questions:

* `/health` — is the process up? Cheap, no I/O. This is what a load balancer polls, and what the
  demo uses to warm Render's free tier out of a cold start before the interview.
* `/health/db` — can we actually serve traffic? Touches Postgres. A process that is up but cannot
  reach its database should not receive requests, and only this endpoint can tell the difference.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    environment: str
    version: str


class ReadinessResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unreachable"]
    features: dict[str, str]


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health() -> HealthResponse:
    """Public. No auth, no database — deliberately cheap."""
    return HealthResponse(status="ok", environment=settings.environment, version="0.1.0")


@router.get("/health/db", response_model=ReadinessResponse, summary="Readiness probe")
async def readiness(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReadinessResponse:
    """Public. Reports database reachability and which optional features are configured.

    Returns 503 when the database is unreachable so an orchestrator takes the instance out of
    rotation rather than routing traffic to a pod that will 500 on every request.
    """
    try:
        await db.execute(text("SELECT 1"))
        database: Literal["ok", "unreachable"] = "ok"
    except Exception:
        database = "unreachable"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessResponse(
        status="ok" if database == "ok" else "degraded",
        database=database,
        features=settings.feature_status(),
    )
