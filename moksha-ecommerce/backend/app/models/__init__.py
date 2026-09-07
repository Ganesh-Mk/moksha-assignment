"""Model package.

Importing this package must register every table on `Base.metadata` — Alembic autogenerate only
sees models that have been imported, and a model missing from here silently produces an empty
migration rather than an error.
"""

from app.models.base import Base, TimestampMixin
from app.models.order import (
    ALLOWED_TRANSITIONS,
    STOCK_HOLDING_STATUSES,
    Order,
    OrderItem,
    OrderStatus,
)
from app.models.product import Product
from app.models.stripe_event import StripeEvent
from app.models.user import User, UserRole

__all__ = [
    "ALLOWED_TRANSITIONS",
    "STOCK_HOLDING_STATUSES",
    "Base",
    "Order",
    "OrderItem",
    "OrderStatus",
    "Product",
    "StripeEvent",
    "TimestampMixin",
    "User",
    "UserRole",
]
