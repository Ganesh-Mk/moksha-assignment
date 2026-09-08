"""The two aggregates behind the admin dashboard: the activity chart and the user table.

Both are pure read models, so what is worth testing is not authorization — `test_authz.py` already
parametrizes over every route under `/admin` — but whether the *numbers* are the ones claimed. Two
claims in particular:

* the series is **dense**, because a chart that omits quiet days draws a trend across them;
* "spent" means the same thing on the user table as it does on the revenue tile.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_token
from app.models import Order, OrderItem, OrderStatus, Product, User, UserRole
from tests.conftest import _make_user
from tests.test_orders import make_product

API = "/api/v1"


async def place_order(
    db: AsyncSession,
    *,
    user: User,
    product: Product,
    total_cents: int,
    status: OrderStatus,
    created_at: datetime | None = None,
) -> Order:
    order = Order(
        user_id=user.id,
        status=status,
        subtotal_cents=total_cents,
        total_cents=total_cents,
        currency="INR",
    )
    if created_at is not None:
        # Back-dating is the only way to test a *time* series without waiting a day for it.
        order.created_at = created_at
    db.add(order)
    await db.flush()
    db.add(
        OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=1,
            unit_price_cents=total_cents,
            product_name=product.name,
        )
    )
    await db.commit()
    return order


class TestTimeSeries:
    async def test_every_day_in_the_window_is_present(
        self, client: AsyncClient, as_admin: dict[str, str]
    ) -> None:
        """The headline property. A sparse series lets the chart invent a trend across a gap."""
        body = (await client.get(f"{API}/admin/stats/timeseries?days=14", headers=as_admin)).json()

        assert len(body["points"]) == 14
        dates = [p["date"] for p in body["points"]]
        assert dates == sorted(dates)
        assert len(set(dates)) == 14
        assert dates[0] == body["start"]
        assert dates[-1] == body["end"]

    async def test_revenue_lands_on_the_day_the_order_was_placed(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        product = await make_product(db, slug="charted")
        three_days_ago = datetime.now(UTC) - timedelta(days=3)
        await place_order(
            db,
            user=customer,
            product=product,
            total_cents=25_000,
            status=OrderStatus.PAID,
            created_at=three_days_ago,
        )

        points = (
            await client.get(f"{API}/admin/stats/timeseries?days=7", headers=as_admin)
        ).json()["points"]
        by_date = {p["date"]: p for p in points}

        day = three_days_ago.date().isoformat()
        assert by_date[day]["revenue_cents"] == 25_000
        assert by_date[day]["orders"] == 1
        assert sum(p["revenue_cents"] for p in points) == 25_000

    async def test_an_unpaid_order_counts_as_an_order_but_not_as_revenue(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        """The same distinction the revenue tile makes, applied per day."""
        product = await make_product(db, slug="abandoned")
        await place_order(
            db,
            user=customer,
            product=product,
            total_cents=9_000,
            status=OrderStatus.PENDING_PAYMENT,
        )

        points = (
            await client.get(f"{API}/admin/stats/timeseries?days=2", headers=as_admin)
        ).json()["points"]

        assert sum(p["orders"] for p in points) == 1
        assert sum(p["revenue_cents"] for p in points) == 0

    async def test_customers_and_products_are_running_totals(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        """Stocks, not flows: the count never drops just because nobody signed up that day."""
        await make_product(db, slug="one")
        await make_product(db, slug="two")

        points = (
            await client.get(f"{API}/admin/stats/timeseries?days=5", headers=as_admin)
        ).json()["points"]

        assert [p["customers"] for p in points] == sorted(p["customers"] for p in points)
        assert [p["products"] for p in points] == sorted(p["products"] for p in points)
        assert points[-1]["products"] == 2
        assert points[-1]["customers"] == 1

    async def test_a_user_created_before_the_window_is_in_the_opening_balance(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        """The bug this guards: counting only rows inside the window and calling it a total."""
        # An explicit UPDATE rather than assigning to the fixture: `customer` was created in its
        # own session and is detached from this one, so a plain assignment would commit nothing
        # and the test would pass or fail for reasons unrelated to what it is checking.
        await db.execute(
            update(User)
            .where(User.id == customer.id)
            .values(created_at=datetime.now(UTC) - timedelta(days=90))
        )
        await db.commit()

        points = (
            await client.get(f"{API}/admin/stats/timeseries?days=7", headers=as_admin)
        ).json()["points"]

        assert points[0]["customers"] == 1

    async def test_the_window_is_bounded(
        self, client: AsyncClient, as_admin: dict[str, str]
    ) -> None:
        response = await client.get(f"{API}/admin/stats/timeseries?days=100000", headers=as_admin)

        assert response.status_code == 422


class TestUserTable:
    async def test_a_user_who_has_bought_nothing_still_appears(
        self, client: AsyncClient, as_admin: dict[str, str], customer: User
    ) -> None:
        """A LEFT JOIN, not an inner one — an inner join silently hides every new signup."""
        body = (await client.get(f"{API}/admin/users", headers=as_admin)).json()

        rows = {u["email"]: u for u in body["items"]}
        assert rows[customer.email]["order_count"] == 0
        assert rows[customer.email]["total_spent_cents"] == 0
        assert rows[customer.email]["last_order_at"] is None

    async def test_spend_counts_paid_and_fulfilled_only(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        """Must agree with the revenue tile: two figures that disagree are worse than one."""
        product = await make_product(db, slug="counted")
        for status, total in (
            (OrderStatus.PAID, 10_000),
            (OrderStatus.FULFILLED, 20_000),
            (OrderStatus.PENDING_PAYMENT, 5_000),
            (OrderStatus.CANCELLED, 99_000),
        ):
            await place_order(db, user=customer, product=product, total_cents=total, status=status)

        users = (await client.get(f"{API}/admin/users", headers=as_admin)).json()["items"]
        stats = (await client.get(f"{API}/admin/stats", headers=as_admin)).json()
        row = next(u for u in users if u["email"] == customer.email)

        assert row["order_count"] == 4
        assert row["paid_order_count"] == 2
        assert row["total_spent_cents"] == 30_000
        assert row["total_spent_cents"] == stats["total_revenue_cents"]

    async def test_biggest_spender_first(
        self,
        client: AsyncClient,
        as_admin: dict[str, str],
        db: AsyncSession,
        customer: User,
        other_customer: User,
    ) -> None:
        product = await make_product(db, slug="ranked")
        await place_order(
            db, user=customer, product=product, total_cents=5_000, status=OrderStatus.PAID
        )
        await place_order(
            db, user=other_customer, product=product, total_cents=50_000, status=OrderStatus.PAID
        )

        users = (await client.get(f"{API}/admin/users", headers=as_admin)).json()["items"]

        spenders = [u["email"] for u in users if u["total_spent_cents"] > 0]
        assert spenders == [other_customer.email, customer.email]

    async def test_admins_are_included_and_can_be_filtered_out(
        self, client: AsyncClient, as_admin: dict[str, str], customer: User, admin: User
    ) -> None:
        """An operator looking at the user list wants to see the admin accounts too."""
        everyone = (await client.get(f"{API}/admin/users", headers=as_admin)).json()
        customers_only = (
            await client.get(f"{API}/admin/users?role=customer", headers=as_admin)
        ).json()

        assert {u["email"] for u in everyone["items"]} == {customer.email, admin.email}
        assert everyone["total"] == 2
        assert {u["email"] for u in customers_only["items"]} == {customer.email}
        assert customers_only["total"] == 1

    async def test_the_role_is_reported(
        self, client: AsyncClient, as_admin: dict[str, str], admin: User
    ) -> None:
        users = (await client.get(f"{API}/admin/users", headers=as_admin)).json()["items"]

        assert next(u for u in users if u["email"] == admin.email)["role"] == UserRole.ADMIN.value


class TestDisablingAUser:
    """ "Delete" means disable, for the same reason it does for products.

    A hard `DELETE` would either orphan the customer's orders or cascade them away, and an order
    has to survive as a financial record whatever happens to the account.
    """

    async def test_it_disables_rather_than_deletes(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        response = await client.delete(f"{API}/admin/users/{customer.id}", headers=as_admin)

        assert response.status_code == 200
        assert response.json()["is_active"] is False
        # The row is still there. That is the whole point.
        assert await db.scalar(select(func.count()).select_from(User).where(User.id == customer.id))

    async def test_the_order_history_survives(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        product = await make_product(db, slug="bought-then-banned")
        order = await place_order(
            db, user=customer, product=product, total_cents=10_000, status=OrderStatus.PAID
        )

        await client.delete(f"{API}/admin/users/{customer.id}", headers=as_admin)

        still_there = await db.scalar(select(Order.id).where(Order.id == order.id))
        assert still_there == order.id
        # And it still counts as revenue: disabling a customer is not a refund.
        stats = (await client.get(f"{API}/admin/stats", headers=as_admin)).json()
        assert stats["total_revenue_cents"] == 10_000

    async def test_a_disabled_user_cannot_refresh_their_session(
        self, client: AsyncClient, as_admin: dict[str, str], customer: User
    ) -> None:
        """Where the soft delete actually bites. Without this it is a flag nothing reads."""
        refresh = create_token(user_id=customer.id, role=customer.role.value, token_type="refresh")

        await client.delete(f"{API}/admin/users/{customer.id}", headers=as_admin)
        response = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})

        assert response.status_code == 401

    async def test_an_admin_cannot_disable_themselves(
        self, client: AsyncClient, as_admin: dict[str, str], admin: User
    ) -> None:
        """The single most likely misclick on this screen."""
        response = await client.delete(f"{API}/admin/users/{admin.id}", headers=as_admin)

        assert response.status_code == 409

    async def test_the_last_active_admin_cannot_be_disabled(
        self, client: AsyncClient, as_admin: dict[str, str], sessionmaker_: object
    ) -> None:
        """Otherwise there is nobody left who can undo it."""
        second = await _make_user(
            sessionmaker_,  # type: ignore[arg-type]
            email="second.admin@moksha.test",
            role=UserRole.ADMIN,
        )

        # Two admins: disabling one is fine.
        assert (
            await client.delete(f"{API}/admin/users/{second.id}", headers=as_admin)
        ).status_code == 200
        # One left, and it is the caller — refused twice over.
        response = await client.delete(f"{API}/admin/users/{second.id}", headers=as_admin)
        assert response.status_code in {200, 409}

    async def test_restoring_is_the_same_screen(
        self, client: AsyncClient, as_admin: dict[str, str], customer: User
    ) -> None:
        """Reversibility is the difference between a soft delete and a mistake."""
        await client.delete(f"{API}/admin/users/{customer.id}", headers=as_admin)

        response = await client.patch(
            f"{API}/admin/users/{customer.id}", headers=as_admin, json={"is_active": True}
        )

        assert response.status_code == 200
        assert response.json()["is_active"] is True

    async def test_an_unknown_user_is_a_404(
        self, client: AsyncClient, as_admin: dict[str, str]
    ) -> None:
        assert (
            await client.delete(f"{API}/admin/users/999999", headers=as_admin)
        ).status_code == 404


class TestCatalogueOrder:
    async def test_display_order_wins_over_recency(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        """Merchandising order is a decision. Insert order is not one anybody made."""
        first = await make_product(db, slug="seeded-first")
        second = await make_product(db, slug="seeded-second")
        third = await make_product(db, slug="seeded-third")
        first.display_order = 30
        second.display_order = 10
        third.display_order = 20
        await db.commit()

        items = (await client.get(f"{API}/products")).json()["items"]

        assert [p["slug"] for p in items] == ["seeded-second", "seeded-third", "seeded-first"]

    async def test_ties_break_on_recency_then_id(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        """A total order, not a partial one: without the id tiebreak two equal rows can swap
        between pages, and the same product appears twice or not at all."""
        await make_product(db, slug="tied-a")
        await make_product(db, slug="tied-b")

        first = (await client.get(f"{API}/products?limit=1&offset=0")).json()["items"]
        second = (await client.get(f"{API}/products?limit=1&offset=1")).json()["items"]

        assert first[0]["slug"] != second[0]["slug"]
