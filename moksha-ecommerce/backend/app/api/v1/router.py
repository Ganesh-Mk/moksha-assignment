"""v1 router aggregation.

Routers are mounted here and nowhere else, so `main.py` has one line for the whole API surface
and the auth posture of every route group is visible on one screen.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import admin, auth, health, orders, payments, products

api_router = APIRouter()

# Public — no credentials required.
api_router.include_router(health.router)
api_router.include_router(products.router, prefix="/products", tags=["products"])

# Mixed: sign-in and refresh are public (the token is the credential); /me and /logout require
# an access token. Declared per-route, never by default.
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Authenticated customer surface. Every route is scoped to the caller inside the service layer.
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])

# Mixed: creating a checkout session requires the caller to own the order; the webhook is public
# but authenticated by Stripe's signature, because Stripe has no bearer token to send.
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])

# Admin-only. The dependency is declared on the router itself, so a route added there later is
# protected whether or not its author remembers to protect it.
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
