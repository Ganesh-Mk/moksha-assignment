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
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, OrderItem, OrderStatus, Product, User, UserRole
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
