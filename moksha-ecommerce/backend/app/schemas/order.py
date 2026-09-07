"""Order request and response bodies."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models import ALLOWED_TRANSITIONS, OrderStatus
from app.schemas.auth import UserResponse


class CartLineRequest(BaseModel):
    """One requested line.

    There is deliberately **no price field**. The client cannot send an amount, so the server has
    nothing to be tempted to trust — the schema itself enforces server-authoritative pricing
    rather than relying on the handler to ignore what it was sent.
    """

    product_id: int = Field(ge=1)
    quantity: int = Field(ge=1, le=99)


class OrderCreate(BaseModel):
    items: list[CartLineRequest] = Field(min_length=1, max_length=50)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    # The snapshot, not the product's current name — this is what the customer bought.
    product_name: str
    quantity: int
    unit_price_cents: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def line_total_cents(self) -> int:
        return self.quantity * self.unit_price_cents


class OrderResponse(BaseModel):
    """What a customer sees for their own order."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: OrderStatus
    subtotal_cents: int
    total_cents: int
    currency: str
    items: list[OrderItemResponse]
    created_at: datetime
    updated_at: datetime

    # Exposed so the frontend can show a live payment state without inventing its own rules.
    stripe_session_id: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def allowed_transitions(self) -> list[OrderStatus]:
        """The states this order may legally move to next.

        Published rather than reimplemented client-side: the admin UI greys out illegal
        transitions using this, instead of hard-coding a copy of the state machine that will
        drift from the server's.
        """
        return sorted(ALLOWED_TRANSITIONS[self.status])


class AdminOrderResponse(OrderResponse):
    """Everything above, plus who placed it. Admin routes only."""

    user: UserResponse


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
