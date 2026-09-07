"""Webhook idempotency ledger."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class StripeEvent(Base):
    """One row per Stripe event id we have accepted responsibility for.

    Stripe delivers webhooks **at least once** and retries on any non-2xx response, including a
    timeout. Without this ledger, the first retry of `checkout.session.completed` runs the
    handler twice and decrements stock twice for a single purchase (DECISIONS D-005).

    The handler inserts here *before* doing any work. A unique-violation on `event_id` means
    "already handled" and the handler returns 200 immediately. That makes the insert itself the
    idempotency check, rather than a read-then-write that two concurrent retries could both pass.

    No `TimestampMixin`: `received_at` and `processed_at` are the two moments that matter, and an
    `updated_at` on an append-only ledger would be noise.
    """

    __tablename__ = "stripe_events"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Stripe's own event id (`evt_...`). The unique constraint is the whole mechanism.
    event_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Null while in flight. A row with `received_at` set and `processed_at` null is an event that
    # crashed mid-handling — worth alerting on, and the reason the two columns are separate.
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<StripeEvent {self.event_id} type={self.event_type}>"
