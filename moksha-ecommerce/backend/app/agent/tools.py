"""The agent's tools.

Every tool is a thin wrapper over `app/services/`. They call the *same functions the HTTP routers
call*, so a business rule is enforced once and holds for both callers. The agent cannot bypass a
rule because there is no second code path to bypass it through (DECISIONS D-003).

**The security property that matters most is in how these are built.**

Order-scoped tools take **no user argument**. The signed-in user's id is bound at construction
time — it is a closure variable, not a parameter — so it never appears in the tool's JSON schema.
Anything in that schema is under the model's control, and therefore under the *user's* control via
the prompt: with a `user_id` parameter, "show me order 7 belonging to user 3" is a plausible
completion, and a helpful model will try it.

Here there is nothing to fill in. The identity comes from the verified JWT, and ownership is
re-checked inside `order_service` even so — the tool boundary and the service boundary both
enforce it, because one of them will eventually be refactored (D-008).

`tests/test_agent_authz.py` fires exactly those prompts and asserts they fail.
"""

from __future__ import annotations

from typing import Any

from langchain_core.tools import StructuredTool
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.cart import MAX_PER_LINE, CartDraft
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models import User
from app.services import order_service, product_service
from app.services.product_service import ProductFilters

logger = get_logger(__name__)


# The model is told to convert; this keeps the raw integer out of its way as well.
def _money(cents: int, currency: str) -> str:
    symbol = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(currency.upper(), "")
    return f"{symbol}{cents / 100:,.2f}"


def _product_summary(product: Any) -> dict[str, Any]:
    return {
        "name": product.name,
        "slug": product.slug,
        "category": product.category,
        "price": _money(product.price_cents, product.currency),
        "price_cents": product.price_cents,
        "in_stock": product.stock > 0,
        "stock": product.stock,
    }


def build_tools(
    session: AsyncSession, user: User, cart: CartDraft | None = None
) -> list[StructuredTool]:
    """Construct the tool set bound to one request's session and one verified user.

    Built per request rather than defined at module level, precisely so `user` can be a closure
    variable. A module-level tool would have to receive the user as an argument, which is the
    vulnerability this design exists to remove.

    `cart` collects anything the agent proposes adding. Defaulted so a caller that does not care
    about proposals — every test of the read-only tools — need not construct one.
    """
    draft = cart if cart is not None else CartDraft()

    async def list_products(category: str | None = None, in_stock_only: bool = False) -> Any:
        """List products in the store, optionally filtered by category.

        Args:
            category: Restrict to one category, e.g. "style", "cleanse", "treatment".
            in_stock_only: If true, omit products that are currently sold out.
        """
        products, total = await product_service.list_products(
            session,
            filters=ProductFilters(category=category, in_stock_only=in_stock_only),
            limit=25,
        )
        logger.info("agent_tool", extra={"tool": "list_products", "returned": len(products)})
        return {
            "total": total,
            "products": [_product_summary(p) for p in products],
        }

    async def get_product(name_or_slug: str) -> Any:
        """Look up one product's price and stock by name or slug.

        Matches loosely, so "curl gel" finds "Curl Defining Gel". Use this for questions about a
        specific product's price or availability.

        Args:
            name_or_slug: The product name as the customer said it, or its slug.
        """
        product = await product_service.find_product(session, name_or_slug)
        logger.info("agent_tool", extra={"tool": "get_product", "found": product is not None})
        if product is None:
            return {"found": False, "message": f"No product matching “{name_or_slug}”."}
        return {"found": True, **_product_summary(product), "description": product.description}

    async def search_products(query: str) -> Any:
        """Search products by keyword across names and descriptions.

        Args:
            query: What the customer is looking for, e.g. "frizz" or "sulphate free".
        """
        products, total = await product_service.list_products(
            session, filters=ProductFilters(search=query), limit=10
        )
        logger.info("agent_tool", extra={"tool": "search_products", "returned": len(products)})
        return {"total": total, "products": [_product_summary(p) for p in products]}

    async def get_my_orders() -> Any:
        """List the orders belonging to the customer you are talking to.

        Already scoped to them. There is no way to ask for anyone else's.
        """
        orders, total = await order_service.list_orders(session, requester=user, limit=10)
        logger.info(
            "agent_tool",
            extra={"tool": "get_my_orders", "user_id": user.id, "returned": len(orders)},
        )
        return {
            "total": total,
            "orders": [
                {
                    "order_id": o.id,
                    "status": o.status.value,
                    "placed_on": o.created_at.date().isoformat(),
                    "total": _money(o.total_cents, o.currency),
                    "items": [{"product": i.product_name, "quantity": i.quantity} for i in o.items],
                }
                for o in orders
            ],
        }

    async def get_order_status(order_id: int) -> Any:
        """Get the status of one of the customer's own orders.

        Args:
            order_id: The order number the customer is asking about.
        """
        try:
            # `requester=user` is what scopes this. An order belonging to someone else raises
            # NotFoundError from the service — the same 404 the HTTP route returns, and for the
            # same reason: confirming the id exists would leak it (D-007).
            order = await order_service.get_order(session, order_id, requester=user)
        except NotFoundError:
            logger.warning(
                "agent_order_access_denied",
                extra={"tool": "get_order_status", "user_id": user.id, "order_id": order_id},
            )
            return {
                "found": False,
                "message": (
                    f"There is no order {order_id} on this account. "
                    "You can only view your own orders."
                ),
            }

        return {
            "found": True,
            "order_id": order.id,
            "status": order.status.value,
            "placed_on": order.created_at.date().isoformat(),
            "total": _money(order.total_cents, order.currency),
            "items": [
                {
                    "product": i.product_name,
                    "quantity": i.quantity,
                    "unit_price": _money(i.unit_price_cents, order.currency),
                }
                for i in order.items
            ],
        }

    async def add_to_cart(name_or_slug: str, quantity: int = 1) -> Any:
        """Add a product to the customer's cart so they can pay for it.

        This does not place an order and does not take payment. It puts the item in their cart;
        they then open the cart and check out themselves. Use it when a customer asks you to
        order or buy something, and tell them to open the cart to pay.

        Args:
            name_or_slug: The product as the customer said it, e.g. "curl gel".
            quantity: How many. Defaults to 1.
        """
        if quantity < 1:
            return {"added": False, "message": "Quantity must be at least 1."}

        product = await product_service.find_product(session, name_or_slug)
        if product is None:
            return {"added": False, "message": f"No product matching “{name_or_slug}”."}
        if not product.is_active:
            return {"added": False, "message": f"{product.name} is no longer sold."}
        if product.stock <= 0:
            return {"added": False, "message": f"{product.name} is sold out."}

        proposal = draft.add(product, quantity)
        logger.info(
            "agent_tool",
            extra={
                "tool": "add_to_cart",
                "user_id": user.id,
                "product_id": product.id,
                "quantity": proposal.quantity,
            },
        )

        # The clamp is reported rather than hidden: a model told "added 5" when 2 were added
        # will cheerfully tell the customer the wrong thing.
        short = proposal.quantity < quantity
        return {
            "added": True,
            "product": product.name,
            "quantity": proposal.quantity,
            "unit_price": _money(product.price_cents, product.currency),
            "line_total": _money(product.price_cents * proposal.quantity, product.currency),
            "message": (
                f"Only {proposal.quantity} in stock, so {proposal.quantity} added."
                if short
                else f"{proposal.quantity} of {product.name} added to the cart."
            )
            + " They pay by opening the cart and checking out — you cannot do that for them.",
            "max_per_line": MAX_PER_LINE,
        }

    # StructuredTool.from_function infers each schema from the signature and docstring. Note what
    # the order tools' schemas contain: `get_my_orders` takes nothing at all, and
    # `get_order_status` takes only an order id. Neither has a user field for the model to fill.
    return [
        StructuredTool.from_function(coroutine=list_products, name="list_products"),
        StructuredTool.from_function(coroutine=get_product, name="get_product"),
        StructuredTool.from_function(coroutine=search_products, name="search_products"),
        StructuredTool.from_function(coroutine=get_my_orders, name="get_my_orders"),
        StructuredTool.from_function(coroutine=get_order_status, name="get_order_status"),
        StructuredTool.from_function(coroutine=add_to_cart, name="add_to_cart"),
    ]
