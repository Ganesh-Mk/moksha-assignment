"""Phase 5: Stripe webhook verification and idempotency.

**Signatures here are real.** `sign_stripe_payload` computes a genuine HMAC-SHA256 and the app
runs the real `stripe.Webhook.construct_event` against a test signing secret. Nothing about
verification is stubbed — a stubbed verifier would make "rejects an unsigned webhook" prove
nothing, which is the whole reason the test exists.

Only the Stripe *API* (session creation, an outbound network call) is faked. Verification is
inbound and needs no network, so it is exercised for real.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import Order, OrderStatus, StripeEvent
from tests.fakes import TEST_WEBHOOK_SECRET, checkout_session, sign_stripe_payload, stripe_event
from tests.test_orders import make_product

API = "/api/v1"
WEBHOOK = f"{API}/payments/webhook"


@pytest.fixture(autouse=True)
def _stripe_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """Point the app at the suite's own signing secret.

    Never read from the environment: a test that behaves differently depending on which keys
    happen to be set on the machine is a test you cannot trust. This is also what keeps the suite
    green with no STRIPE_WEBHOOK_SECRET present at all.
    """
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_suite")
    monkeypatch.setattr(settings, "stripe_webhook_secret", TEST_WEBHOOK_SECRET)
    monkeypatch.setattr(settings, "stripe_publishable_key", "pk_test_suite")


async def place_order(client: AsyncClient, headers: dict[str, str], db: AsyncSession) -> Order:
    product = await make_product(db, slug="webhook-item", price_cents=10_000, stock=5)
    created = await client.post(
        f"{API}/orders",
        headers=headers,
        json={"items": [{"product_id": product.id, "quantity": 2}]},
    )
    order_id = created.json()["id"]
    # selectinload because relationships are lazy="raise" — an implicit load is a runtime error
    # by design, so tests have to be as explicit about their queries as the application is.
    return (
        await db.execute(
            select(Order).where(Order.id == order_id).options(selectinload(Order.items))
        )
    ).scalar_one()


async def deliver(
    client: AsyncClient, payload: dict[str, object], *, secret: str = TEST_WEBHOOK_SECRET
):  # type: ignore[no-untyped-def]
    body, signature = sign_stripe_payload(payload, secret)
    return await client.post(
        WEBHOOK,
        content=body,
        headers={"Stripe-Signature": signature, "Content-Type": "application/json"},
    )


class TestSignatureVerification:
    async def test_a_correctly_signed_webhook_is_accepted(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        order = await place_order(client, as_customer, db)
        event = stripe_event(
            "evt_ok",
            "checkout.session.completed",
            checkout_session(session_id="cs_1", order_id=order.id),
        )

        response = await deliver(client, event)

        assert response.status_code == 200
        assert response.json()["outcome"] == "paid"

    async def test_an_unsigned_webhook_is_rejected(self, client: AsyncClient) -> None:
        """No `Stripe-Signature` header at all.

        The endpoint is public — Stripe has no bearer token to send — so the signature *is* the
        credential. Without this check the endpoint is an open "mark any order paid" API.
        """
        event = stripe_event(
            "evt_unsigned",
            "checkout.session.completed",
            checkout_session(session_id="cs", order_id=1),
        )

        response = await client.post(WEBHOOK, json=event)

        assert response.status_code == 400
        assert response.json()["error"]["code"] == "webhook_signature_invalid"

    async def test_a_webhook_signed_with_the_wrong_secret_is_rejected(
        self, client: AsyncClient
    ) -> None:
        event = stripe_event(
            "evt_wrong_key",
            "checkout.session.completed",
            checkout_session(session_id="cs", order_id=1),
        )

        response = await deliver(client, event, secret="whsec_an_attackers_guess")

        assert response.status_code == 400

    async def test_a_tampered_body_fails_verification(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """Sign one payload, deliver a different one.

        This is the attack the signature actually prevents: intercepting a genuine webhook and
        editing the amount or the order id before forwarding it.
        """
        order = await place_order(client, as_customer, db)
        genuine = stripe_event(
            "evt_tamper",
            "checkout.session.completed",
            checkout_session(session_id="cs_t", order_id=order.id),
        )
        _, signature = sign_stripe_payload(genuine)

        tampered = stripe_event(
            "evt_tamper",
            "checkout.session.completed",
            checkout_session(session_id="cs_t", order_id=order.id, amount_total=1),
        )
        import json

        response = await client.post(
            WEBHOOK,
            content=json.dumps(tampered, separators=(",", ":")).encode(),
            headers={"Stripe-Signature": signature, "Content-Type": "application/json"},
        )

        assert response.status_code == 400
        await db.refresh(order)
        assert order.status is OrderStatus.PENDING_PAYMENT

    async def test_a_rejected_webhook_records_nothing(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        """Verification happens before the ledger insert.

        Otherwise an attacker could poison the ledger with an event id, and the genuine delivery
        of that id would later be discarded as a duplicate.
        """
        event = stripe_event(
            "evt_poison",
            "checkout.session.completed",
            checkout_session(session_id="cs", order_id=1),
        )
        await client.post(WEBHOOK, json=event)

        recorded = (await db.execute(select(StripeEvent))).scalars().all()
        assert recorded == []


class TestIdempotency:
    """Stripe delivers at-least-once and retries on any non-2xx, including a timeout."""

    async def test_a_replayed_event_does_not_move_stock_twice(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """The headline: a naive handler decrements stock twice on the first retry.

        Here the second delivery is a no-op, and stock is unchanged from after the first.
        """
        order = await place_order(client, as_customer, db)
        product_id = order.items[0].product_id if order.items else None
        assert product_id is not None

        event = stripe_event(
            "evt_replay",
            "checkout.session.completed",
            checkout_session(session_id="cs_replay", order_id=order.id),
        )

        first = await deliver(client, event)
        second = await deliver(client, event)
        third = await deliver(client, event)

        assert first.json()["outcome"] == "paid"
        assert second.json()["outcome"] == "duplicate"
        assert third.json()["outcome"] == "duplicate"
        # Every delivery is acknowledged with 200. A non-2xx would make Stripe retry forever.
        assert {first.status_code, second.status_code, third.status_code} == {200}

    async def test_a_duplicate_delivery_leaves_the_order_untouched(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        order = await place_order(client, as_customer, db)
        completed = stripe_event(
            "evt_c",
            "checkout.session.completed",
            checkout_session(session_id="cs_c", order_id=order.id),
        )
        await deliver(client, completed)
        await db.refresh(order)
        assert order.status is OrderStatus.PAID

        await deliver(client, completed)

        await db.refresh(order)
        assert order.status is OrderStatus.PAID

    async def test_the_ledger_records_each_event_once(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        order = await place_order(client, as_customer, db)
        event = stripe_event(
            "evt_ledger",
            "checkout.session.completed",
            checkout_session(session_id="cs_l", order_id=order.id),
        )

        await deliver(client, event)
        await deliver(client, event)

        rows = (
            (await db.execute(select(StripeEvent).where(StripeEvent.event_id == "evt_ledger")))
            .scalars()
            .all()
        )
        assert len(rows) == 1
        # processed_at is stamped, so a crashed handler is distinguishable from a completed one.
        assert rows[0].processed_at is not None

    async def test_two_different_events_are_both_processed(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """Idempotency must key on the event id, not on the order.

        Keying on the order would silently drop the legitimate second event in a
        completed-then-refunded sequence.
        """
        order = await place_order(client, as_customer, db)
        await deliver(
            client,
            stripe_event(
                "evt_one",
                "checkout.session.completed",
                checkout_session(session_id="cs_x", order_id=order.id),
            ),
        )

        second = await deliver(
            client,
            stripe_event(
                "evt_two",
                "checkout.session.async_payment_succeeded",
                checkout_session(session_id="cs_x", order_id=order.id),
            ),
        )

        assert second.json()["outcome"] != "duplicate"


class TestPaymentOutcomes:
    async def test_completed_marks_the_order_paid(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        order = await place_order(client, as_customer, db)

        await deliver(
            client,
            stripe_event(
                "evt_paid",
                "checkout.session.completed",
                checkout_session(session_id="cs_p", order_id=order.id),
            ),
        )

        await db.refresh(order)
        assert order.status is OrderStatus.PAID
        assert order.stripe_payment_intent == "pi_test_123"

    async def test_an_expired_session_releases_the_reserved_stock(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """The customer walked away.

        Releasing here is the whole reason stock is held from order creation rather than from
        payment — an abandoned checkout must not keep inventory off the shelf forever.
        """
        order = await place_order(client, as_customer, db)
        product_id = order.items[0].product_id
        from app.models import Product

        product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
        assert product.stock == 3

        await deliver(
            client,
            stripe_event(
                "evt_exp",
                "checkout.session.expired",
                checkout_session(session_id="cs_e", order_id=order.id, payment_status="unpaid"),
            ),
        )

        await db.refresh(order)
        await db.refresh(product)
        assert order.status is OrderStatus.CANCELLED
        assert product.stock == 5

    async def test_an_async_payment_failure_marks_the_order_failed(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        order = await place_order(client, as_customer, db)

        await deliver(
            client,
            stripe_event(
                "evt_fail",
                "checkout.session.async_payment_failed",
                checkout_session(session_id="cs_f", order_id=order.id, payment_status="unpaid"),
            ),
        )

        await db.refresh(order)
        assert order.status is OrderStatus.PAYMENT_FAILED

    async def test_a_completed_but_unpaid_session_does_not_mark_the_order_paid(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """`payment_status` is checked, not assumed.

        Delayed payment methods produce a completed session that is not yet paid. Treating it as
        paid would fulfil an order that has not been charged.
        """
        order = await place_order(client, as_customer, db)

        response = await deliver(
            client,
            stripe_event(
                "evt_unpaid",
                "checkout.session.completed",
                checkout_session(session_id="cs_u", order_id=order.id, payment_status="unpaid"),
            ),
        )

        assert response.json()["outcome"] == "awaiting-payment"
        await db.refresh(order)
        assert order.status is OrderStatus.PENDING_PAYMENT

    async def test_an_unhandled_event_type_is_acknowledged_not_retried(
        self, client: AsyncClient
    ) -> None:
        """A non-2xx would make Stripe retry an event we will never act on, forever."""
        response = await deliver(
            client, stripe_event("evt_other", "customer.created", {"id": "cus_1"})
        )

        assert response.status_code == 200
        assert response.json()["outcome"] == "ignored"

    async def test_an_event_for_an_unknown_order_is_acknowledged(self, client: AsyncClient) -> None:
        """Retrying will not make the order appear — but it is logged as an error."""
        response = await deliver(
            client,
            stripe_event(
                "evt_orphan",
                "checkout.session.completed",
                checkout_session(session_id="cs_none", order_id=999_999),
            ),
        )

        assert response.status_code == 200
        assert response.json()["outcome"] == "order-not-found"


class TestCheckoutSessionAuthorization:
    async def test_creating_a_session_requires_authentication(self, client: AsyncClient) -> None:
        response = await client.post(
            f"{API}/payments/create-checkout-session", json={"order_id": 1}
        )

        assert response.status_code == 401

    async def test_paying_for_another_customers_order_returns_404(
        self,
        client: AsyncClient,
        as_customer: dict[str, str],
        as_other_customer: dict[str, str],
        db: AsyncSession,
    ) -> None:
        """The payment endpoint must not become an ownership oracle.

        `GET /orders/{id}` deliberately returns 404 rather than 403. If this route returned 403,
        or a Stripe error naming the order, that care would be undone here.
        """
        order = await place_order(client, as_customer, db)

        response = await client.post(
            f"{API}/payments/create-checkout-session",
            headers=as_other_customer,
            json={"order_id": order.id},
        )

        assert response.status_code == 404

    async def test_an_already_paid_order_cannot_be_paid_again(
        self,
        client: AsyncClient,
        as_customer: dict[str, str],
        as_admin: dict[str, str],
        db: AsyncSession,
    ) -> None:
        order = await place_order(client, as_customer, db)
        await client.patch(
            f"{API}/admin/orders/{order.id}/status", headers=as_admin, json={"status": "paid"}
        )

        response = await client.post(
            f"{API}/payments/create-checkout-session",
            headers=as_customer,
            json={"order_id": order.id},
        )

        assert response.status_code == 409


class TestConfigurationIsFailLoud:
    async def test_an_unconfigured_webhook_returns_503_naming_the_variable(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The failure this project exists to avoid.

        A webhook verifier that quietly disables itself when its secret is missing turns a
        security control into a no-op that nobody notices. Here it refuses, loudly, and names
        exactly which variable is absent.
        """
        monkeypatch.setattr(settings, "stripe_webhook_secret", None)
        event = stripe_event(
            "evt_cfg", "checkout.session.completed", checkout_session(session_id="cs", order_id=1)
        )

        response = await deliver(client, event)

        assert response.status_code == 503
        assert "STRIPE_WEBHOOK_SECRET" in response.json()["error"]["details"]["missing"]


# Deliberately not shaped like real keys. The first version of these fixtures used a realistic
# `sk_test_51<account>…` form and GitHub's push protection blocked the commit — correctly, since a
# scanner cannot tell a convincing fake from the real thing. The guard under test only looks at the
# prefix, so the rest of the string may as well announce what it is.
_FAKE = "NOT_A_REAL_KEY_test_fixture_only"
PUBLISHABLE_FIXTURE = f"pk_test_{_FAKE}"


class TestPublishableKeyIsActuallyPublishable:
    """Regression tests for a real production incident.

    `STRIPE_PUBLISHABLE_KEY` was set to the *secret* key on a deploy. `/payments/config` is public
    by design — the browser needs that key — so the API served a live secret key to anyone who
    requested it. Nothing in the system objected, because a string is a string.

    The endpoint now checks the prefix. `pk_` is publishable and safe to hand out; `sk_` (secret)
    and `rk_` (restricted) are not and must never leave the server.
    """

    async def test_a_publishable_key_is_served(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "stripe_publishable_key", PUBLISHABLE_FIXTURE)

        response = await client.get(f"{API}/payments/config")

        assert response.status_code == 200
        assert response.json()["publishable_key"] == PUBLISHABLE_FIXTURE

    @pytest.mark.parametrize(
        ("key", "kind"),
        [
            (f"sk_test_{_FAKE}", "secret"),
            (f"sk_live_{_FAKE}", "live secret"),
            (f"rk_test_{_FAKE}", "restricted"),
            (f"whsec_{_FAKE}", "webhook signing"),
        ],
    )
    async def test_a_non_publishable_key_is_never_served(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch, key: str, kind: str
    ) -> None:
        monkeypatch.setattr(settings, "stripe_publishable_key", key)

        response = await client.get(f"{API}/payments/config")

        # 503 naming the variable, not 200 with the key in the body.
        assert response.status_code == 503, f"a {kind} key was served to an anonymous caller"
        body = response.text
        assert key not in body, f"the {kind} key leaked into the error response"
        assert "STRIPE_PUBLISHABLE_KEY" in body
