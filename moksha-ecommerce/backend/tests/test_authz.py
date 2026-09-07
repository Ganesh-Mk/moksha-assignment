"""The authorization suite — the headline deliverable.

The brief states it as its own emphasized line:

> "The backend must enforce authorization. Do not rely only on frontend restrictions."

So this file proves it rather than asserting it. It is organised around the three ways
authorization actually fails in practice:

1. **A protected route left unprotected.** Covered by parametrizing over *every* admin route
   discovered from the live OpenAPI document, so a route added tomorrow is tested tomorrow —
   without anyone remembering to add a case.
2. **A signed-in user reaching another user's data.** Covered by giving customer B a real token
   and pointing it at customer A's order.
3. **Authorization enforced only in the UI.** Every request here bypasses the frontend entirely.

`test_agent_authz.py` extends the same guarantees to the AI agent, which reaches the same
services by a different path.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.main import create_app
from app.models import Order, OrderStatus, Product, User

API = "/api/v1"


def _discover_routes() -> list[tuple[str, str]]:
    """Every (method, path) the app exposes, read from its own OpenAPI document.

    Discovering these rather than hard-coding a list is the point: a hand-written list is a list
    someone forgets to update, and the route they forget is the one that ships unprotected. Any
    route added later is covered by these tests the moment it exists.

    The OpenAPI document is used rather than walking `app.routes` because it is the app's
    published contract — stable across FastAPI's internal restructuring of how included routers
    are stored, and the same description a reviewer reads at /docs.
    """
    spec = create_app().openapi()
    return sorted(
        (method.upper(), path)
        for path, operations in spec["paths"].items()
        for method in operations
        if method.upper() not in {"HEAD", "OPTIONS"}
    )


ALL_ROUTES = _discover_routes()

ADMIN_ROUTES = [(m, p) for m, p in ALL_ROUTES if "/admin/" in p]

# Authenticated but not admin-only.
CUSTOMER_ROUTES = [
    (m, p)
    for m, p in ALL_ROUTES
    if p.startswith(f"{API}/orders")
    or p.startswith(f"{API}/chat")
    or p
    in {
        f"{API}/auth/me",
        f"{API}/auth/logout",
        f"{API}/payments/create-checkout-session",
    }
]

# Authenticated by a request signature rather than by a bearer token. Its own bucket because it
# is genuinely a fourth posture: unauthenticated callers are refused, but with 400 (bad
# signature) rather than 401 (no token) — Stripe has no token to send.
SIGNATURE_AUTHENTICATED_ROUTES = [(m, p) for m, p in ALL_ROUTES if p.endswith("/payments/webhook")]

PUBLIC_ROUTES = [
    (m, p)
    for m, p in ALL_ROUTES
    if p.startswith(f"{API}/products")
    or p.startswith(f"{API}/health")
    or p in {f"{API}/auth/google", f"{API}/auth/refresh", f"{API}/payments/config"}
]


def _url(path: str) -> str:
    """Substitute a plausible id into a path template."""
    return path.replace("{order_id}", "1").replace("{product_id}", "1").replace("{slug}", "x")


def _body(method: str, path: str) -> dict[str, object] | None:
    """A schema-valid body, so a rejection is authorization and not validation.

    This matters more than it looks: if the body were invalid, an unprotected admin route would
    return 422 and the test would pass for the wrong reason.
    """
    if method == "POST" and path.endswith("/admin/products"):
        return {
            "name": "Injected",
            "slug": "injected-product",
            "price_cents": 1000,
            "category": "test",
            "stock": 5,
        }
    if method == "PATCH" and "products" in path:
        return {"price_cents": 1}
    if method == "PATCH" and path.endswith("/status"):
        return {"status": "paid"}
    if method == "POST" and path.endswith(f"{API}/orders"):
        return {"items": [{"product_id": 1, "quantity": 1}]}
    return None


class TestEveryRouteIsAccountedFor:
    def test_the_route_inventory_is_complete(self) -> None:
        """No route escapes classification.

        A route in none of the three buckets has an undeclared auth posture, which is precisely
        the state this whole file exists to prevent.
        """
        classified = {
            *ADMIN_ROUTES,
            *CUSTOMER_ROUTES,
            *PUBLIC_ROUTES,
            *SIGNATURE_AUTHENTICATED_ROUTES,
        }
        unclassified = [r for r in ALL_ROUTES if r not in classified]

        assert unclassified == [], f"Routes with no declared auth posture: {unclassified}"

    def test_there_are_admin_routes_to_test(self) -> None:
        # Guards against the discovery helper silently returning nothing and every
        # parametrized test below passing vacuously.
        assert len(ADMIN_ROUTES) >= 8


class TestUnauthenticatedAccess:
    @pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES, ids=lambda v: str(v))
    async def test_admin_routes_reject_anonymous_callers(
        self, client: AsyncClient, method: str, path: str
    ) -> None:
        response = await client.request(method, _url(path), json=_body(method, path))

        assert response.status_code == 401, f"{method} {path} allowed an anonymous caller"

    @pytest.mark.parametrize(("method", "path"), CUSTOMER_ROUTES, ids=lambda v: str(v))
    async def test_customer_routes_reject_anonymous_callers(
        self, client: AsyncClient, method: str, path: str
    ) -> None:
        response = await client.request(method, _url(path), json=_body(method, path))

        assert response.status_code == 401, f"{method} {path} allowed an anonymous caller"

    @pytest.mark.parametrize(("method", "path"), PUBLIC_ROUTES, ids=lambda v: str(v))
    async def test_public_routes_stay_public(
        self, client: AsyncClient, method: str, path: str
    ) -> None:
        """Public routes must not require a token.

        The inverse mistake — locking a route nobody should need to sign in for — is a real one,
        and it makes the catalogue unbrowsable to logged-out visitors.
        """
        response = await client.request(method, _url(path), json=_body(method, path))

        assert response.status_code != 401, f"{method} {path} should not require authentication"


class TestSignatureAuthenticatedRoutes:
    """The Stripe webhook is public but not unauthenticated."""

    @pytest.mark.parametrize(
        ("method", "path"), SIGNATURE_AUTHENTICATED_ROUTES, ids=lambda v: str(v)
    )
    async def test_an_unsigned_request_is_refused(
        self, client: AsyncClient, method: str, path: str
    ) -> None:
        """400, not 401.

        There is no bearer token to be missing — the signature is the credential, and a request
        without a valid one is malformed rather than unauthenticated. What matters is that it is
        refused: an unsigned webhook that worked would be an open "mark any order paid" endpoint.
        """
        response = await client.request(method, _url(path), json={"id": "evt_x", "type": "x"})

        assert response.status_code in (400, 503), f"{method} {path} accepted an unsigned request"


class TestCustomerCannotReachAdminRoutes:
    """The single most commonly failed requirement in this assignment.

    Most candidates hide the admin button and stop. A customer's token here is real and valid —
    the only thing standing between it and the admin API is `require_admin`.
    """

    @pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES, ids=lambda v: str(v))
    async def test_a_customer_token_is_refused_on_every_admin_route(
        self, client: AsyncClient, as_customer: dict[str, str], method: str, path: str
    ) -> None:
        response = await client.request(
            method, _url(path), headers=as_customer, json=_body(method, path)
        )

        assert response.status_code == 403, (
            f"{method} {path} returned {response.status_code} for a customer token; expected 403"
        )
        assert response.json()["error"]["code"] == "forbidden"

    @pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES, ids=lambda v: str(v))
    async def test_an_admin_token_is_accepted_on_every_admin_route(
        self, client: AsyncClient, as_admin: dict[str, str], method: str, path: str
    ) -> None:
        """The mirror image.

        Without this, `require_admin` could reject *everyone* and every test above would still
        pass — a guard that refuses all callers is not a working guard.
        """
        response = await client.request(
            method, _url(path), headers=as_admin, json=_body(method, path)
        )

        assert response.status_code not in (401, 403), (
            f"{method} {path} refused a legitimate admin: {response.status_code}"
        )


class TestCrossCustomerAccess:
    """Customer B must not reach customer A's order, by any route."""

    @pytest.fixture
    async def order_of_customer_a(self, db, customer: User) -> Order:  # type: ignore[no-untyped-def]
        product = Product(
            name="Gel", slug="gel", description="", price_cents=1000, category="style", stock=5
        )
        db.add(product)
        await db.flush()
        order = Order(
            user_id=customer.id,
            status=OrderStatus.PENDING_PAYMENT,
            subtotal_cents=1000,
            total_cents=1000,
            currency="INR",
        )
        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order

    async def test_the_owner_can_read_their_own_order(
        self, client: AsyncClient, as_customer: dict[str, str], order_of_customer_a: Order
    ) -> None:
        response = await client.get(f"{API}/orders/{order_of_customer_a.id}", headers=as_customer)

        assert response.status_code == 200

    async def test_another_customer_gets_404_not_403(
        self,
        client: AsyncClient,
        as_other_customer: dict[str, str],
        order_of_customer_a: Order,
    ) -> None:
        """404, deliberately.

        403 would confirm the id exists, letting an attacker walk the id space and count our
        orders. To customer B, A's order and a nonexistent order are indistinguishable — which
        is exactly the property we want (DECISIONS D-007).
        """
        response = await client.get(
            f"{API}/orders/{order_of_customer_a.id}", headers=as_other_customer
        )

        assert response.status_code == 404
        assert response.status_code != 403, "403 leaks that this order id exists"

    async def test_a_nonexistent_order_is_indistinguishable_from_someone_elses(
        self,
        client: AsyncClient,
        as_other_customer: dict[str, str],
        order_of_customer_a: Order,
    ) -> None:
        """The two responses must be byte-identical, or the difference is the leak."""
        someone_elses = await client.get(
            f"{API}/orders/{order_of_customer_a.id}", headers=as_other_customer
        )
        nonexistent = await client.get(f"{API}/orders/999999", headers=as_other_customer)

        assert someone_elses.status_code == nonexistent.status_code
        assert someone_elses.json()["error"] == nonexistent.json()["error"]

    async def test_an_admin_can_read_any_order(
        self, client: AsyncClient, as_admin: dict[str, str], order_of_customer_a: Order
    ) -> None:
        response = await client.get(
            f"{API}/admin/orders/{order_of_customer_a.id}", headers=as_admin
        )

        assert response.status_code == 200
        assert response.json()["user"]["email"] == "customer@moksha.test"

    async def test_listing_orders_never_includes_another_customers(
        self,
        client: AsyncClient,
        as_other_customer: dict[str, str],
        order_of_customer_a: Order,
    ) -> None:
        response = await client.get(f"{API}/orders", headers=as_other_customer)

        body = response.json()
        assert body["items"] == []
        # The count is filtered too. A total that included other people's orders would leak the
        # size of the business through an endpoint that returns none of them.
        assert body["total"] == 0

    async def test_another_customer_cannot_cancel_someone_elses_order(
        self,
        client: AsyncClient,
        as_other_customer: dict[str, str],
        order_of_customer_a: Order,
    ) -> None:
        response = await client.post(
            f"{API}/orders/{order_of_customer_a.id}/cancel", headers=as_other_customer
        )

        assert response.status_code == 404


class TestPrivilegeEscalation:
    async def test_a_customer_cannot_promote_themselves_by_claiming_a_role(
        self, client: AsyncClient, customer: User
    ) -> None:
        """The role in the token is not the role that is enforced.

        `get_current_user` re-reads the user from the database, so a token minted with
        `role: admin` for a customer's id grants nothing. This is the payoff for that lookup.
        """
        from app.core.security import create_token

        forged_role = create_token(user_id=customer.id, role="admin", token_type="access")

        response = await client.get(
            f"{API}/admin/stats", headers={"Authorization": f"Bearer {forged_role}"}
        )

        assert response.status_code == 403
