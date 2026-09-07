"""Stripe endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Header, Request, status
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.core.logging import get_logger
from app.schemas.order import OrderResponse
from app.services import payment_service

logger = get_logger(__name__)

router = APIRouter()


class CheckoutSessionRequest(BaseModel):
    """An order id and nothing else.

    Deliberately minimal: with no amount, currency or line items in the request, there is nothing
    a client could send that would change what it is charged. The session is built entirely from
    the order rows already in our database.
    """

    order_id: int


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    order: OrderResponse


class WebhookAck(BaseModel):
    received: bool
    outcome: str


@router.post(
    "/create-checkout-session",
    response_model=CheckoutSessionResponse,
    summary="Start a Stripe Checkout session",
    description=(
        "**Authenticated, owner only.** Builds a Stripe Checkout session from the order rows in "
        "our database and returns the URL to redirect to.\n\n"
        "The request carries an order id and nothing else — no amount, no line items — so a "
        "client cannot influence what it is charged.\n\n"
        "Paying for another customer's order returns **404**, the same as reading it: the "
        "payment endpoint must not become an ownership oracle that `GET /orders/{id}` refuses "
        "to be. Returns **409** if the order is not awaiting payment, and **503** naming the "
        "missing variable if Stripe is not configured."
    ),
)
async def create_checkout_session(
    payload: CheckoutSessionRequest, session: DbSession, user: CurrentUser
) -> CheckoutSessionResponse:
    order, checkout_url = await payment_service.create_checkout_session(
        session, order_id=payload.order_id, user=user
    )
    return CheckoutSessionResponse(
        checkout_url=checkout_url, order=OrderResponse.model_validate(order)
    )


@router.post(
    "/webhook",
    response_model=WebhookAck,
    status_code=status.HTTP_200_OK,
    summary="Stripe webhook",
    description=(
        "**Public endpoint, authenticated by signature.** No bearer token — Stripe has none to "
        "send. The `Stripe-Signature` header *is* the credential, and an unsigned or "
        "badly-signed request is rejected with **400** before any work happens.\n\n"
        "**This is the only thing that marks an order paid.** The browser's redirect to "
        "`/checkout/success` is a client-side navigation a user can perform by typing a URL; "
        "trusting it would hand out free orders.\n\n"
        "**Idempotent.** Stripe delivers at-least-once and retries on any non-2xx. Every event "
        "id is inserted into the `stripe_events` ledger *before* any work is done — a "
        "unique-constraint violation means 'already handled' and returns 200 immediately. "
        "Without it, the first retry would decrement stock twice.\n\n"
        "Handled: `checkout.session.completed` → paid · `expired` → cancelled, stock released · "
        "`async_payment_failed` → payment_failed. Anything else is acknowledged and ignored, "
        "because a non-2xx would make Stripe retry an event we will never act on."
    ),
)
async def stripe_webhook(
    request: Request,
    session: DbSession,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> WebhookAck:
    # The raw body, byte for byte. Re-serializing parsed JSON changes whitespace and key order,
    # and the HMAC stops matching — the classic reason a webhook "randomly" fails verification.
    payload = await request.body()

    event = payment_service.verify_webhook(payload, stripe_signature)
    outcome = await payment_service.handle_webhook_event(session, event)

    return WebhookAck(received=True, outcome=outcome)


@router.get(
    "/config",
    summary="Stripe publishable key",
    description=(
        "**Public.** The publishable key is designed to be public — it identifies the account "
        "and can only create payment attempts. Served from here rather than baked into the "
        "frontend bundle so the same build works against test and live accounts."
    ),
)
async def stripe_config() -> dict[str, str]:
    return {"publishable_key": await payment_service.get_publishable_key()}
