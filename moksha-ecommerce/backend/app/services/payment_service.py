"""Stripe Checkout and the webhook.

Two properties matter more than everything else in this file, and both come from how Stripe
actually behaves rather than from how it is documented to behave in the happy path:

**1. The webhook is the only source of truth for payment.**
The browser's redirect to `/checkout/success` is a client-side navigation. A user can type that
URL. If the redirect marked orders paid, anyone could have anything for free. Only a
signature-verified webhook — a server-to-server statement signed with a secret only Stripe and we
hold — moves an order to `paid` (DECISIONS D-010).

**2. Delivery is at-least-once, so handling must be idempotent.**
Stripe retries on any non-2xx, including a timeout, and can deliver out of order. The handler
records the event id *first*; a unique-violation means "already handled" and it returns
immediately. Without that, the first retry of `checkout.session.completed` runs the handler twice
and decrements stock twice (D-005).

The Stripe client is created per call from `settings.require_stripe()`, which raises a 503 naming
the missing variable if the keys are absent. It never falls back to a disabled verifier — a
webhook endpoint that silently stops checking signatures is the exact bug this project exists to
avoid.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PaymentError,
    WebhookVerificationError,
)
from app.core.logging import get_logger
from app.models import Order, OrderStatus, StripeEvent, User
from app.services import order_service

logger = get_logger(__name__)

# Only these are acted on. Anything else is acknowledged with 200 and ignored — returning an
# error for an event we simply do not handle would make Stripe retry it forever and eventually
# disable the endpoint.
HANDLED_EVENTS = frozenset(
    {
        "checkout.session.completed",
        "checkout.session.expired",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
    }
)


def _client() -> stripe.StripeClient:
    secret_key, _ = settings.require_stripe()
    return stripe.StripeClient(secret_key)


async def create_checkout_session(
    session: AsyncSession, *, order_id: int, user: User
) -> tuple[Order, str]:
    """Create a Stripe Checkout session for one of the caller's own orders.

    Ownership goes through `order_service.get_order`, so paying for someone else's order returns
    the same 404 as reading it — the payment endpoint cannot be used as an ownership oracle that
    the order endpoint refuses to be.

    The line items are built from the **order rows in our database**, never from the request. The
    client sends an order id and nothing else, so there is no amount for it to influence.
    """
    order = await order_service.get_order(session, order_id, requester=user)

    if order.status is not OrderStatus.PENDING_PAYMENT:
        raise ConflictError(
            f"This order is {order.status.value.replace('_', ' ')} and cannot be paid for again."
        )

    if order.stripe_session_id:
        # Reusing the existing session rather than creating a second one. Two live sessions
        # against one order means two ways to pay it, and the `stripe_session_id` unique
        # constraint would reject the second anyway — better to be deliberate than to collide.
        try:
            existing = _client().checkout.sessions.retrieve(order.stripe_session_id)
        except stripe.StripeError:
            existing = None  # expired or unreachable; fall through and make a new one
        if existing is not None and existing.status == "open" and existing.url:
            return order, existing.url

    client = _client()
    try:
        checkout = client.checkout.sessions.create(
            params={
                "mode": "payment",
                "line_items": [
                    {
                        "price_data": {
                            "currency": order.currency.lower(),
                            "product_data": {"name": item.product_name},
                            # Already integer cents, which is exactly what Stripe expects — the
                            # benefit of never having converted money to a float (D-004).
                            "unit_amount": item.unit_price_cents,
                        },
                        "quantity": item.quantity,
                    }
                    for item in order.items
                ],
                # How the webhook finds its way back to our order. Set here rather than parsed
                # out of a URL, because the webhook has no URL to parse.
                "client_reference_id": str(order.id),
                "customer_email": order.user.email,
                "metadata": {"order_id": str(order.id), "user_id": str(order.user_id)},
                "success_url": (
                    f"{settings.frontend_url}/checkout/success"
                    f"?order_id={order.id}&session_id={{CHECKOUT_SESSION_ID}}"
                ),
                "cancel_url": f"{settings.frontend_url}/checkout/cancelled?order_id={order.id}",
            }
        )
    except stripe.StripeError as exc:
        logger.exception("stripe_session_create_failed", extra={"order_id": order.id})
        raise PaymentError("Could not start checkout. Please try again.") from exc

    order.stripe_session_id = checkout.id
    await session.commit()
    await session.refresh(order)

    logger.info(
        "checkout_session_created",
        extra={"order_id": order.id, "stripe_session_id": checkout.id},
    )

    if not checkout.url:
        raise PaymentError("Stripe did not return a checkout URL.")
    return order, checkout.url


def verify_webhook(payload: bytes, signature_header: str | None) -> stripe.Event:
    """Verify a webhook's signature, or refuse it.

    `stripe.Webhook.construct_event` checks an HMAC-SHA256 over `"{timestamp}.{body}"` against the
    signing secret, and enforces a timestamp tolerance so a captured request cannot be replayed
    days later.

    The raw body must be passed through byte-for-byte. Re-serializing parsed JSON changes
    whitespace and key order, and the signature stops matching — a subtle, and very common,
    reason for a webhook that "randomly" fails.
    """
    _, webhook_secret = settings.require_stripe()

    if not signature_header:
        raise WebhookVerificationError("Missing Stripe-Signature header.")

    try:
        return stripe.Webhook.construct_event(payload, signature_header, webhook_secret)
    except ValueError as exc:
        raise WebhookVerificationError("Malformed webhook payload.") from exc
    except stripe.SignatureVerificationError as exc:
        # Logged as a warning, not an error: an invalid signature is either a misconfigured
        # secret or someone probing the endpoint. Both are worth seeing; neither is a crash.
        logger.warning("webhook_signature_invalid")
        raise WebhookVerificationError("Webhook signature verification failed.") from exc


async def _claim_event(session: AsyncSession, event_id: str, event_type: str) -> bool:
    """Record the event id, returning False if it was already recorded.

    The insert *is* the idempotency check. A read-then-write ("have we seen this?" then "record
    it") has a window where two concurrent retries both read "no" and both proceed; a unique
    constraint has no such window, because the database resolves the race.
    """
    session.add(StripeEvent(event_id=event_id, event_type=event_type))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        logger.info("webhook_duplicate_ignored", extra={"stripe_event_id": event_id})
        return False
    return True


async def _mark_processed(session: AsyncSession, event_id: str) -> None:
    """Stamp `processed_at`.

    A row with `received_at` set and `processed_at` null is an event that crashed mid-handling —
    which is worth alerting on, and the reason the two columns are separate.
    """
    record = (
        await session.execute(select(StripeEvent).where(StripeEvent.event_id == event_id))
    ).scalar_one_or_none()
    if record is not None:
        record.processed_at = datetime.now(UTC)
        await session.commit()


async def _resolve_order(session: AsyncSession, checkout_session: dict[str, Any]) -> Order | None:
    """Find our order from a Stripe checkout session object.

    Tries `client_reference_id` first, then the stored `stripe_session_id`. Two routes because a
    session created before a deploy might predate the metadata we now set, and losing a payment
    to a lookup miss is not an acceptable failure mode.
    """
    reference = checkout_session.get("client_reference_id")
    if reference:
        try:
            order_id = int(reference)
        except (TypeError, ValueError):
            order_id = 0
        if order_id:
            order = (
                await session.execute(select(Order).where(Order.id == order_id))
            ).scalar_one_or_none()
            if order is not None:
                return await order_service.get_order(session, order.id, requester=None)

    session_id = checkout_session.get("id")
    if session_id:
        return await order_service.get_order_by_stripe_session(session, str(session_id))

    return None


async def handle_webhook_event(session: AsyncSession, event: stripe.Event) -> str:
    """Process one verified event, exactly once.

    Returns a short outcome string for the response body and the logs. Never raises for an event
    we simply do not handle: a non-2xx makes Stripe retry, and retrying something we will never
    act on wastes deliveries and eventually gets the endpoint disabled.
    """
    event_id = str(event["id"])
    event_type = str(event["type"])

    if event_type not in HANDLED_EVENTS:
        logger.info("webhook_ignored", extra={"stripe_event_id": event_id, "type": event_type})
        return "ignored"

    if not await _claim_event(session, event_id, event_type):
        return "duplicate"

    # `.to_dict()` rather than `dict(...)`: stripe-python returns a `StripeObject`, which is not
    # a mapping. Working with a plain dict from here on also keeps `_resolve_order` and
    # `_apply_event` trivially testable with hand-built payloads.
    raw_object = event["data"]["object"]
    checkout_session: dict[str, Any] = (
        raw_object.to_dict() if hasattr(raw_object, "to_dict") else dict(raw_object)
    )
    order = await _resolve_order(session, checkout_session)

    if order is None:
        # Acknowledged, not retried. If we cannot find the order the payload refers to, retrying
        # will not make it appear — but it does need a loud log line, because it means a customer
        # may have paid for something we cannot match.
        logger.error(
            "webhook_order_not_found",
            extra={"stripe_event_id": event_id, "type": event_type},
        )
        await _mark_processed(session, event_id)
        return "order-not-found"

    outcome = await _apply_event(session, order, event_type, checkout_session)
    await _mark_processed(session, event_id)

    logger.info(
        "webhook_processed",
        extra={
            "stripe_event_id": event_id,
            "type": event_type,
            "order_id": order.id,
            "outcome": outcome,
        },
    )
    return outcome


async def _apply_event(
    session: AsyncSession,
    order: Order,
    event_type: str,
    checkout_session: dict[str, Any],
) -> str:
    payment_intent = checkout_session.get("payment_intent")
    if payment_intent and not order.stripe_payment_intent:
        order.stripe_payment_intent = str(payment_intent)
        await session.commit()

    if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        # `payment_status` is checked rather than assumed. A completed session with
        # `unpaid`/`no_payment_required` exists for delayed methods, and treating it as paid
        # would fulfil an order that has not been charged yet.
        if checkout_session.get("payment_status") != "paid":
            logger.info(
                "webhook_completed_but_unpaid",
                extra={
                    "order_id": order.id,
                    "payment_status": checkout_session.get("payment_status"),
                },
            )
            return "awaiting-payment"

        await order_service.transition_status(session, order.id, new_status=OrderStatus.PAID)
        return "paid"

    if event_type == "checkout.session.expired":
        # The customer walked away. Releasing the reserved stock is the whole reason stock is
        # held from order creation rather than from payment.
        await order_service.transition_status(session, order.id, new_status=OrderStatus.CANCELLED)
        return "cancelled"

    if event_type == "checkout.session.async_payment_failed":
        await order_service.transition_status(
            session, order.id, new_status=OrderStatus.PAYMENT_FAILED
        )
        return "payment-failed"

    return "ignored"


async def get_publishable_key() -> str:
    if not settings.stripe_publishable_key:
        raise NotFoundError("Stripe is not configured.")
    return settings.stripe_publishable_key
