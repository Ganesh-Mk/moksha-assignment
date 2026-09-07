"""Application factory.

`create_app()` rather than a module-level `app` so the test suite can build an isolated instance
with its own dependency overrides, and so nothing in this module runs at import time.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.core.exceptions import install_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import CorrelationIdMiddleware
from app.core.platform import apply_windows_event_loop_policy
from app.database import engine

# Must run before any event loop exists, so it happens at import rather than in the lifespan.
apply_windows_event_loop_policy()

logger = get_logger(__name__)

API_V1 = "/api/v1"

DESCRIPTION = """
Backend for the Moksha AI e-commerce assignment.

**Authorization is enforced here, not in the frontend.** Every endpoint below states its
requirement: *public*, *authenticated*, or *admin*. Hiding a button in the UI is UX; this is
the security boundary.

* Money is integer **cents** throughout. Order totals are recomputed server-side from database
  prices — a client-supplied amount is never trusted.
* Customers can read only their own orders; another user's order returns **404**, not 403, so the
  endpoint cannot be used to enumerate order ids.
* The Stripe webhook verifies its signature and is idempotent, because Stripe delivers
  at-least-once and retries.
"""


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    configure_logging()
    if settings.is_production:
        # Refuse to serve rather than come up half-configured: a production instance with Stripe
        # disabled looks healthy to the load balancer and accepts orders it cannot charge.
        settings.assert_production_ready()
    logger.info(
        "startup",
        extra={"environment": settings.environment, "features": settings.feature_status()},
    )
    yield
    await engine.dispose()
    logger.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Moksha Commerce API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # The frontend reads the correlation id to show in error toasts; without this it cannot
        # see the header at all, because CORS hides non-simple response headers by default.
        expose_headers=["X-Request-ID"],
    )

    install_exception_handlers(app)
    app.include_router(api_router, prefix=API_V1)
    return app


app = create_app()
