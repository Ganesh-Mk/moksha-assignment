"""Orders, line items, and the order state machine."""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.user import User


class OrderStatus(enum.StrEnum):
    """The order lifecycle.

        pending_payment ──> paid ──> fulfilled
               │
               ├──> payment_failed
               └──> cancelled

    Reserved stock is released on both terminal failure states. Which transitions are legal is
    enforced in `order_service`, in one place — see `ALLOWED_TRANSITIONS` below, which lives
    beside the enum so the diagram and the rule cannot drift apart.
    """

    # StrEnum, so the value serialises as "paid" in JSON and in the JWT claim with no custom
    # encoder, and `status == "paid"` works against a value decoded from a request.
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    FULFILLED = "fulfilled"
    PAYMENT_FAILED = "payment_failed"
    CANCELLED = "cancelled"


# A status with no outgoing transitions is terminal. Encoding this as data rather than as a chain
# of `if` statements means the API can *publish* the state machine, and the admin UI can grey out
# transitions it would be rejected for instead of discovering them by trial.
ALLOWED_TRANSITIONS: dict[OrderStatus, frozenset[OrderStatus]] = {
    OrderStatus.PENDING_PAYMENT: frozenset(
        {OrderStatus.PAID, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED}
    ),
    OrderStatus.PAID: frozenset({OrderStatus.FULFILLED, OrderStatus.CANCELLED}),
    OrderStatus.FULFILLED: frozenset(),
    OrderStatus.PAYMENT_FAILED: frozenset(),
    OrderStatus.CANCELLED: frozenset(),
}

# Statuses that hold stock. Moving *out* of one of these into a non-holding status must release
# it; moving between two holding statuses must not. Deriving the release rule from this set is
# what makes double-release impossible when Stripe retries a webhook.
STOCK_HOLDING_STATUSES: frozenset[OrderStatus] = frozenset(
    {OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.FULFILLED}
)


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", values_callable=lambda e: [m.value for m in e]),
        default=OrderStatus.PENDING_PAYMENT,
        nullable=False,
        index=True,
    )

    # Both totals are computed server-side from database prices at creation time and stored.
    # A client-supplied amount is never trusted, and storing the result means the order still
    # reads back correctly after a price change.
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    # Unique so a retried create-checkout-session call cannot attach a second Stripe session to
    # the same order, and so the webhook can look an order up by session id.
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    stripe_payment_intent: Mapped[str | None] = mapped_column(String(255), index=True)

    user: Mapped[User] = relationship(back_populates="orders", lazy="raise")
    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="OrderItem.id",
    )

    __table_args__ = (
        CheckConstraint("subtotal_cents >= 0", name="subtotal_non_negative"),
        CheckConstraint("total_cents >= 0", name="total_non_negative"),
        # "My orders, newest first" is the single most-run query in the app; this serves it
        # directly. It also covers the ownership check, which filters on user_id alone.
        Index("ix_orders_user_id_created_at", "user_id", "created_at"),
    )

    @property
    def holds_stock(self) -> bool:
        return self.status in STOCK_HOLDING_STATUSES

    def __repr__(self) -> str:
        return f"<Order id={self.id} user_id={self.user_id} status={self.status.value}>"


class OrderItem(Base, TimestampMixin):
    """A line on an order — and a historical record, not a live join to `products`.

    `unit_price_cents` and `product_name` are snapshotted at purchase time (DECISIONS D-006).
    If an admin later edits the price or renames the product, past orders must keep showing what
    the customer actually agreed to pay. Reading the price through the FK instead would silently
    rewrite history, and would break outright once a product is deactivated.
    """

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # RESTRICT, not CASCADE: deleting a product must not silently delete the evidence that it was
    # sold. The catalogue uses `is_active = false` for removal instead.
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)

    order: Mapped[Order] = relationship(back_populates="items", lazy="raise")
    product: Mapped[Product] = relationship(lazy="raise")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_price_cents >= 0", name="unit_price_non_negative"),
        # One line per product per order. Adding the same product twice must increase quantity,
        # not create a second row — otherwise the oversell lock, which locks each product row
        # once, would under-count what the order is asking for.
        Index("uq_order_items_order_product", "order_id", "product_id", unique=True),
    )

    @property
    def line_total_cents(self) -> int:
        return self.quantity * self.unit_price_cents

    @property
    def product_image_url(self) -> str | None:
        """The product's *current* image — deliberately not snapshotted like name and price.

        The line drawn here is between what was **agreed** and what is merely **shown**. Price and
        name are terms of the transaction: if either changed, a past order would misrepresent what
        the customer actually bought, so both are copied at purchase time (DECISIONS D-006).

        An image is presentation. Re-shooting a product does not change what was sold, and showing
        the current picture of the same item is more correct than showing a stale one. Reading it
        live also means the order page cannot drift from the catalogue.

        Safe to read because the FK is `ON DELETE RESTRICT`: a product that has ever been ordered
        cannot be deleted, only deactivated, so `self.product` is always there. It will raise
        rather than lazy-load if a caller forgot to eager-load it — which is the point.
        """
        return self.product.image_url

    def __repr__(self) -> str:
        return (
            f"<OrderItem order_id={self.order_id} product_id={self.product_id} qty={self.quantity}>"
        )
