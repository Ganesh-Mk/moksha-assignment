"""Phase 3: catalogue reads and admin writes."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, OrderItem, OrderStatus, User
from tests.test_orders import make_product

API = "/api/v1"


class TestPublicCatalogue:
    async def test_listing_is_public(self, client: AsyncClient, db: AsyncSession) -> None:
        await make_product(db, slug="public-item")

        response = await client.get(f"{API}/products")

        assert response.status_code == 200
        assert response.json()["total"] == 1

    async def test_deactivated_products_are_invisible_to_customers(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        visible = await make_product(db, slug="visible")
        hidden = await make_product(db, slug="hidden")
        hidden.is_active = False
        await db.commit()

        listing = await client.get(f"{API}/products")
        detail = await client.get(f"{API}/products/{hidden.slug}")

        assert [p["slug"] for p in listing.json()["items"]] == [visible.slug]
        # 404 not 403: from outside, a withdrawn product is indistinguishable from one that
        # never existed.
        assert detail.status_code == 404

    async def test_include_inactive_is_not_a_client_settable_filter(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        """A soft delete a client can undo with a query parameter is not a soft delete."""
        hidden = await make_product(db, slug="still-hidden")
        hidden.is_active = False
        await db.commit()

        response = await client.get(f"{API}/products?include_inactive=true")

        assert response.json()["total"] == 0

    async def test_search_matches_name_and_description(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        await make_product(db, slug="curl-defining-gel")
        await make_product(db, slug="heat-shield-spray")

        response = await client.get(f"{API}/products?search=curl")

        assert [p["slug"] for p in response.json()["items"]] == ["curl-defining-gel"]

    async def test_a_search_containing_a_wildcard_does_not_match_everything(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        """ILIKE wildcards in user input are escaped.

        Unescaped, a search for "%" would return the whole catalogue, and "_" would match any
        single character — surprising for the user and a small information leak on an admin
        listing that includes withdrawn products.
        """
        await make_product(db, slug="alpha")
        await make_product(db, slug="beta")

        response = await client.get(f"{API}/products?search=%25")

        assert response.json()["total"] == 0

    async def test_in_stock_filter(self, client: AsyncClient, db: AsyncSession) -> None:
        await make_product(db, slug="available", stock=5)
        await make_product(db, slug="sold-out", stock=0)

        response = await client.get(f"{API}/products?in_stock_only=true")

        assert [p["slug"] for p in response.json()["items"]] == ["available"]

    async def test_pagination_reports_the_unpaginated_total(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        for i in range(5):
            await make_product(db, slug=f"item-{i}")

        response = await client.get(f"{API}/products?limit=2&offset=0")

        body = response.json()
        assert len(body["items"]) == 2
        assert body["total"] == 5

    async def test_categories_route_is_not_shadowed_by_the_slug_route(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        """`/products/categories` must not resolve as a product named "categories".

        FastAPI matches in declaration order, so this passing depends on `/categories` being
        declared before `/{slug}`.
        """
        await make_product(db, slug="a-product")

        response = await client.get(f"{API}/products/categories")

        assert response.status_code == 200
        assert response.json() == ["style"]

    async def test_prices_are_returned_as_integer_cents(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        await make_product(db, slug="priced", price_cents=49_900)

        product = (await client.get(f"{API}/products/priced")).json()

        assert product["price_cents"] == 49_900
        assert isinstance(product["price_cents"], int)


class TestAdminCatalogue:
    async def test_an_admin_sees_deactivated_products(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession
    ) -> None:
        hidden = await make_product(db, slug="withdrawn-item")
        hidden.is_active = False
        await db.commit()

        response = await client.get(f"{API}/admin/products", headers=as_admin)

        assert response.json()["total"] == 1

    async def test_create(self, client: AsyncClient, as_admin: dict[str, str]) -> None:
        response = await client.post(
            f"{API}/admin/products",
            headers=as_admin,
            json={
                "name": "New Product",
                "slug": "new-product",
                "description": "d",
                "price_cents": 12_345,
                "category": "Style",
                "stock": 7,
            },
        )

        assert response.status_code == 201
        # Categories are normalised on write so filtering is an exact indexed match.
        assert response.json()["category"] == "style"

    async def test_a_duplicate_slug_is_a_409_not_a_500(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession
    ) -> None:
        await make_product(db, slug="taken-slug")

        response = await client.post(
            f"{API}/admin/products",
            headers=as_admin,
            json={
                "name": "Clash",
                "slug": "taken-slug",
                "price_cents": 100,
                "category": "style",
                "stock": 1,
            },
        )

        assert response.status_code == 409

    async def test_patch_leaves_omitted_fields_alone(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession
    ) -> None:
        product = await make_product(db, slug="partial", price_cents=1000)

        await client.patch(
            f"{API}/admin/products/{product.id}", headers=as_admin, json={"stock": 42}
        )

        await db.refresh(product)
        assert product.stock == 42
        assert product.price_cents == 1000

    async def test_the_slug_cannot_be_changed(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession
    ) -> None:
        """The slug is the product's public URL; changing it 404s every existing link."""
        product = await make_product(db, slug="stable-slug")

        await client.patch(
            f"{API}/admin/products/{product.id}", headers=as_admin, json={"slug": "new-slug"}
        )

        await db.refresh(product)
        assert product.slug == "stable-slug"

    async def test_delete_is_a_soft_delete(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession
    ) -> None:
        product = await make_product(db, slug="to-withdraw")

        response = await client.delete(f"{API}/admin/products/{product.id}", headers=as_admin)

        assert response.status_code == 200
        await db.refresh(product)
        assert product.is_active is False

    async def test_withdrawing_a_product_does_not_break_past_orders(
        self,
        client: AsyncClient,
        as_admin: dict[str, str],
        as_customer: dict[str, str],
        db: AsyncSession,
    ) -> None:
        """The whole reason delete is soft (DECISIONS D-006)."""
        product = await make_product(db, slug="sold-then-withdrawn", stock=5)
        created = await client.post(
            f"{API}/orders",
            headers=as_customer,
            json={"items": [{"product_id": product.id, "quantity": 1}]},
        )
        order_id = created.json()["id"]

        await client.delete(f"{API}/admin/products/{product.id}", headers=as_admin)

        order = await client.get(f"{API}/orders/{order_id}", headers=as_customer)
        assert order.status_code == 200
        assert order.json()["items"][0]["product_name"] == "Sold Then Withdrawn"

    async def test_an_invalid_slug_shape_is_rejected(
        self, client: AsyncClient, as_admin: dict[str, str]
    ) -> None:
        response = await client.post(
            f"{API}/admin/products",
            headers=as_admin,
            json={
                "name": "Bad Slug",
                "slug": "Not A Slug!",
                "price_cents": 100,
                "category": "style",
                "stock": 1,
            },
        )

        assert response.status_code == 422

    async def test_a_negative_price_is_rejected_before_reaching_the_database(
        self, client: AsyncClient, as_admin: dict[str, str]
    ) -> None:
        response = await client.post(
            f"{API}/admin/products",
            headers=as_admin,
            json={
                "name": "Free Money",
                "slug": "negative-price",
                "price_cents": -100,
                "category": "style",
                "stock": 1,
            },
        )

        assert response.status_code == 422


class TestDashboardStats:
    async def test_revenue_counts_only_paid_and_fulfilled_orders(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession, customer: User
    ) -> None:
        """A pending order is not revenue.

        Counting it would overstate takings by every abandoned checkout — the figure an operator
        would notice being wrong first.
        """
        product = await make_product(db, slug="revenue", price_cents=10_000, stock=100)
        for status, total in (
            (OrderStatus.PAID, 10_000),
            (OrderStatus.FULFILLED, 20_000),
            (OrderStatus.PENDING_PAYMENT, 50_000),
            (OrderStatus.CANCELLED, 99_000),
        ):
            order = Order(
                user_id=customer.id,
                status=status,
                subtotal_cents=total,
                total_cents=total,
                currency="INR",
            )
            db.add(order)
            await db.flush()
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=1,
                    unit_price_cents=total,
                    product_name=product.name,
                )
            )
        await db.commit()

        stats = (await client.get(f"{API}/admin/stats", headers=as_admin)).json()

        assert stats["total_revenue_cents"] == 30_000
        assert stats["paid_order_count"] == 2
        assert stats["total_order_count"] == 4

    async def test_low_stock_lists_the_scarcest_first(
        self, client: AsyncClient, as_admin: dict[str, str], db: AsyncSession
    ) -> None:
        await make_product(db, slug="plenty-left", stock=500)
        await make_product(db, slug="running-low", stock=3)
        await make_product(db, slug="nearly-gone", stock=1)

        stats = (await client.get(f"{API}/admin/stats", headers=as_admin)).json()

        assert [p["slug"] for p in stats["low_stock"]] == ["nearly-gone", "running-low"]
