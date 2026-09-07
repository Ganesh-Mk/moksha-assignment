"""Phase 4: order business logic.

The three rules that carry the most weight, each proved rather than asserted:

1. The total is recomputed from database prices — a client cannot influence it.
2. Stock cannot be oversold, including under genuine concurrency.
3. Status transitions follow the state machine, and stock is released exactly once.
"""

from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.exceptions import InsufficientStockError
from app.models import Order, Product, User
from app.services import order_service
from app.services.order_service import CartLine

API = "/api/v1"


async def make_product(
    db: AsyncSession, *, slug: str, price_cents: int = 10_000, stock: int = 10
) -> Product:
    product = Product(
        name=slug.replace("-", " ").title(),
        slug=slug,
        description="",
        price_cents=price_cents,
        category="style",
        stock=stock,
        currency="INR",
        is_active=True,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


class TestServerAuthoritativePricing:
    async def test_the_total_is_computed_from_database_prices(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        a = await make_product(db, slug="a", price_cents=49_900)
        b = await make_product(db, slug="b", price_cents=54_900)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={
                "items": [
                    {"product_id": a.id, "quantity": 2},
                    {"product_id": b.id, "quantity": 1},
                ]
            },
        )

        assert response.status_code == 201
        assert response.json()["total_cents"] == 49_900 * 2 + 54_900

    async def test_the_request_schema_has_nowhere_to_put_a_price(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """A smuggled price is ignored, because the schema does not define the field.

        This is stronger than remembering to ignore it in the handler: the API shape itself makes
        the rule hard to violate. A checkout that trusted a client amount would let anyone buy
        anything for one cent.
        """
        product = await make_product(db, slug="pricey", price_cents=99_900)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={
                "items": [{"product_id": product.id, "quantity": 1, "unit_price_cents": 1}],
                "total_cents": 1,
            },
        )

        assert response.status_code == 201
        assert response.json()["total_cents"] == 99_900

    async def test_line_items_snapshot_the_price_at_purchase_time(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        product = await make_product(db, slug="changing", price_cents=10_000)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )
        order_id = created.json()["id"]

        product.price_cents = 25_000
        await db.commit()

        response = await client.get(f"{API}/orders/{order_id}", headers=as_customer)

        assert response.json()["total_cents"] == 10_000
        assert response.json()["items"][0]["unit_price_cents"] == 10_000


class TestStock:
    async def test_stock_is_decremented_on_order(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        product = await make_product(db, slug="stocked", stock=10)

        await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 3}]},
        )

        await db.refresh(product)
        assert product.stock == 7

    async def test_ordering_more_than_available_is_refused(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        product = await make_product(db, slug="scarce", stock=2)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 3}]},
        )

        assert response.status_code == 409
        body = response.json()["error"]
        assert body["code"] == "insufficient_stock"
        # The available count is returned so the UI can say "only 2 left" rather than "failed".
        assert body["details"]["available"] == 2

    async def test_a_failed_line_rolls_back_the_whole_order(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """An order is never half-reserved.

        The first product would succeed on its own; because the second fails, the transaction
        rolls back and the first product's stock is untouched.
        """
        ok = await make_product(db, slug="plenty", stock=10)
        short = await make_product(db, slug="none-left", stock=0)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={
                "items": [
                    {"product_id": ok.id, "quantity": 1},
                    {"product_id": short.id, "quantity": 1},
                ]
            },
        )

        assert response.status_code == 409
        await db.refresh(ok)
        assert ok.stock == 10, "stock was reserved for a line in an order that failed"

    async def test_an_inactive_product_cannot_be_ordered(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        product = await make_product(db, slug="withdrawn", stock=5)
        product.is_active = False
        await db.commit()

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )

        assert response.status_code == 409

    async def test_duplicate_lines_are_merged_not_double_counted(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """Two lines for one product must combine before the stock check.

        The row-lock takes one lock per product. Unmerged, each line would be validated against
        the full stock independently, and together they could oversell it — the lock would be
        held correctly and the answer would still be wrong.
        """
        product = await make_product(db, slug="dupe", stock=3)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={
                "items": [
                    {"product_id": product.id, "quantity": 2},
                    {"product_id": product.id, "quantity": 2},
                ]
            },
        )

        assert response.status_code == 409, "4 units were accepted against a stock of 3"
        await db.refresh(product)
        assert product.stock == 3


class TestConcurrentCheckout:
    """The oversell test.

    This is why the suite runs against real PostgreSQL. `SELECT … FOR UPDATE` is what serialises
    the two transactions; SQLite does not implement it, so on SQLite this test would pass while
    proving nothing at all.
    """

    async def test_two_simultaneous_orders_for_the_last_unit(
        self,
        sessionmaker_: async_sessionmaker[AsyncSession],
        db: AsyncSession,
        customer: User,
        other_customer: User,
    ) -> None:
        product = await make_product(db, slug="last-one", price_cents=64_900, stock=1)

        async def buy(user: User) -> str:
            # Each buyer gets its own session, so these are two genuinely independent
            # transactions racing — not two calls sharing one connection, which would serialise
            # for the wrong reason and make the test meaningless.
            async with sessionmaker_() as session:
                try:
                    await order_service.create_order(
                        session,
                        user=user,
                        lines=[CartLine(product_id=product.id, quantity=1)],
                    )
                except InsufficientStockError:
                    return "sold-out"
                return "bought"

        results = await asyncio.gather(buy(customer), buy(other_customer))

        assert sorted(results) == ["bought", "sold-out"], (
            f"expected exactly one winner, got {results}"
        )

        await db.refresh(product)
        assert product.stock == 0, "the last unit was sold twice"

        orders = (await db.execute(select(Order))).scalars().all()
        assert len(orders) == 1

    async def test_five_simultaneous_orders_against_two_units(
        self,
        sessionmaker_: async_sessionmaker[AsyncSession],
        db: AsyncSession,
        customer: User,
    ) -> None:
        """Wider contention: five racers, two units, exactly two winners."""
        product = await make_product(db, slug="two-left", stock=2)

        async def buy() -> bool:
            async with sessionmaker_() as session:
                try:
                    await order_service.create_order(
                        session, user=customer, lines=[CartLine(product_id=product.id, quantity=1)]
                    )
                except InsufficientStockError:
                    return False
                return True

        results = await asyncio.gather(*(buy() for _ in range(5)))

        assert sum(results) == 2
        await db.refresh(product)
        assert product.stock == 0

    async def test_concurrent_orders_for_products_in_opposite_order_do_not_deadlock(
        self,
        sessionmaker_: async_sessionmaker[AsyncSession],
        db: AsyncSession,
        customer: User,
        other_customer: User,
    ) -> None:
        """Locks are always taken in ascending product id, so opposing carts cannot deadlock.

        Without a deterministic lock order, one transaction holding row 1 and waiting for row 2
        while the other holds 2 and waits for 1 would deadlock, and Postgres would abort one
        after its deadlock_timeout. Both must simply succeed.
        """
        first = await make_product(db, slug="lock-a", stock=5)
        second = await make_product(db, slug="lock-b", stock=5)

        async def buy(user: User, ids: list[int]) -> bool:
            async with sessionmaker_() as session:
                await order_service.create_order(
                    session,
                    user=user,
                    lines=[CartLine(product_id=pid, quantity=1) for pid in ids],
                )
                return True

        results = await asyncio.wait_for(
            asyncio.gather(
                buy(customer, [first.id, second.id]),
                buy(other_customer, [second.id, first.id]),
            ),
            timeout=15,
        )

        assert results == [True, True]


class TestStatusTransitions:
    async def test_an_admin_can_advance_a_paid_order_to_fulfilled(
        self,
        client: AsyncClient,
        as_admin: dict[str, str],
        as_customer: dict[str, str],
        db: AsyncSession,
    ) -> None:
        product = await make_product(db, slug="flow", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )
        order_id = created.json()["id"]

        paid = await client.patch(
            f"{API}/admin/orders/{order_id}/status", headers=as_admin, json={"status": "paid"}
        )
        fulfilled = await client.patch(
            f"{API}/admin/orders/{order_id}/status", headers=as_admin, json={"status": "fulfilled"}
        )

        assert paid.json()["status"] == "paid"
        assert fulfilled.json()["status"] == "fulfilled"

    async def test_an_illegal_transition_is_refused_and_names_both_states(
        self,
        client: AsyncClient,
        as_admin: dict[str, str],
        as_customer: dict[str, str],
        db: AsyncSession,
    ) -> None:
        product = await make_product(db, slug="skip", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )
        order_id = created.json()["id"]

        # pending_payment -> fulfilled skips payment entirely.
        response = await client.patch(
            f"{API}/admin/orders/{order_id}/status", headers=as_admin, json={"status": "fulfilled"}
        )

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "invalid_state_transition"
        assert response.json()["error"]["details"] == {
            "current": "pending_payment",
            "requested": "fulfilled",
        }

    async def test_a_terminal_status_cannot_be_left(
        self,
        client: AsyncClient,
        as_admin: dict[str, str],
        as_customer: dict[str, str],
        db: AsyncSession,
    ) -> None:
        product = await make_product(db, slug="terminal", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )
        order_id = created.json()["id"]
        await client.patch(
            f"{API}/admin/orders/{order_id}/status", headers=as_admin, json={"status": "cancelled"}
        )

        response = await client.patch(
            f"{API}/admin/orders/{order_id}/status", headers=as_admin, json={"status": "paid"}
        )

        assert response.status_code == 409

    async def test_cancelling_returns_stock_to_the_catalogue(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        product = await make_product(db, slug="returned", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 2}]},
        )
        await db.refresh(product)
        assert product.stock == 3

        await client.post(f"{API}/orders/{created.json()['id']}/cancel", headers=as_customer)

        await db.refresh(product)
        assert product.stock == 5

    async def test_stock_is_released_exactly_once_however_many_times_cancel_is_called(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """Double-release would silently inflate inventory.

        The transition table is what prevents it: `cancelled` is terminal, so the second attempt
        is rejected before `_release_stock` is ever reached.
        """
        product = await make_product(db, slug="once", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 2}]},
        )
        order_id = created.json()["id"]

        await client.post(f"{API}/orders/{order_id}/cancel", headers=as_customer)
        second = await client.post(f"{API}/orders/{order_id}/cancel", headers=as_customer)

        assert second.status_code == 409
        await db.refresh(product)
        assert product.stock == 5, "stock was released twice"

    async def test_moving_between_two_stock_holding_states_does_not_release_stock(
        self,
        client: AsyncClient,
        as_admin: dict[str, str],
        as_customer: dict[str, str],
        db: AsyncSession,
    ) -> None:
        """pending_payment -> paid both hold stock, so nothing is returned."""
        product = await make_product(db, slug="holding", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 2}]},
        )

        await client.patch(
            f"{API}/admin/orders/{created.json()['id']}/status",
            headers=as_admin,
            json={"status": "paid"},
        )

        await db.refresh(product)
        assert product.stock == 3

    async def test_a_customer_cannot_cancel_a_paid_order(
        self,
        client: AsyncClient,
        as_admin: dict[str, str],
        as_customer: dict[str, str],
        db: AsyncSession,
    ) -> None:
        """A paid order needs a refund — money moving is an admin action, not a button."""
        product = await make_product(db, slug="paid-order", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )
        order_id = created.json()["id"]
        await client.patch(
            f"{API}/admin/orders/{order_id}/status", headers=as_admin, json={"status": "paid"}
        )

        response = await client.post(f"{API}/orders/{order_id}/cancel", headers=as_customer)

        assert response.status_code == 409


class TestOrderValidation:
    async def test_an_empty_cart_is_refused(
        self, client: AsyncClient, as_customer: dict[str, str]
    ) -> None:
        response = await client.post(f"{API}/orders", headers=as_customer, json={"items": []})

        assert response.status_code == 422

    async def test_a_nonexistent_product_is_refused(
        self, client: AsyncClient, as_customer: dict[str, str]
    ) -> None:
        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": 999_999, "quantity": 1}]},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize("quantity", [0, -1, 100])
    async def test_out_of_range_quantities_are_refused(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession, quantity: int
    ) -> None:
        product = await make_product(db, slug=f"qty-{quantity}", stock=500)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": quantity}]},
        )

        assert response.status_code == 422


class TestOrderResponses:
    async def test_the_response_publishes_the_legal_next_states(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        """So the admin UI greys out illegal transitions instead of copying the state machine."""
        product = await make_product(db, slug="transitions", stock=5)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )

        assert set(response.json()["allowed_transitions"]) == {
            "paid",
            "payment_failed",
            "cancelled",
        }

    async def test_a_customer_order_response_does_not_include_the_buyer(
        self, client: AsyncClient, as_customer: dict[str, str], db: AsyncSession
    ) -> None:
        # Only AdminOrderResponse carries the user. Not a leak here (it is the caller's own
        # record), but the two schemas should stay distinct so the admin-only fields stay
        # admin-only as the model grows.
        product = await make_product(db, slug="no-user", stock=5)

        response = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )

        assert "user" not in response.json()
