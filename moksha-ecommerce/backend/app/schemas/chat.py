"""Chat request and response bodies.

Moved out of the router when the reply stopped being a bare string: a schema defined inside a
router is invisible to everything except that router, and the cart proposal below is consumed by
the service, the streaming endpoint and the JSON endpoint alike.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(
        default_factory=list,
        max_length=40,
        description="Prior turns. Trimmed server-side to the most recent few.",
    )


class CartProposal(BaseModel):
    """A cart line the agent is asking the browser to add.

    **A proposal, not an order.** The agent cannot take money and cannot create an order; the
    customer still has to open the cart and pay. What the server guarantees about this object is
    only that the product *exists*, is *live*, and had this much stock when it was checked — the
    same three things it would guarantee if the customer had clicked the button themselves.

    The prices here are display-only, exactly like the client's own cart snapshot (D-012). The
    amount actually charged is recomputed from the database inside `order_service` at checkout.
    Nothing in this payload is trusted on the way back in.
    """

    product_id: int
    slug: str
    name: str
    quantity: int
    unit_price_cents: int
    currency: str
    image_url: str | None
    stock: int


class ChatResponse(BaseModel):
    reply: str
    cart: list[CartProposal] = Field(
        default_factory=list,
        description=(
            "Cart lines the agent added on the customer's behalf, for the client to apply to "
            "its local cart. Empty for every turn that did not use the cart tool."
        ),
    )
