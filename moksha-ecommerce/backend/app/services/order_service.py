"""Order business logic: totals, stock, ownership, and the status state machine.

This module is the single source of truth for all four. The HTTP routers and the AI agent's tools
both call these functions, so a rule enforced here is enforced for both — there is no second code
path to bypass it through (DECISIONS D-003).

Three rules are load-bearing and each has a test that proves it:

1. **Totals are recomputed from the database.** A client-sent amount is never read. A checkout
   that trusted the client would let anyone buy anything for one cent.
2. **Stock moves under `SELECT … FOR UPDATE`.** Two concurrent checkouts for the last unit must
   not both succeed (D-009).
3. **Ownership is checked here, not in the router.** A customer reading someone else's order gets
   `NotFoundError` — 404, not 403, because 403 confirms the id exists (D-007).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictError,
    InsufficientStockError,
    InvalidStateTransitionError,
    NotFoundError,
    ValidationError,
)
from app.core.logging import get_logger
from app.models import (
    ALLOWED_TRANSITIONS,
    STOCK_HOLDING_STATUSES,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    User,
    UserRole,
)

logger = get_logger(__name__)

MAX_LINE_ITEMS = 50
MAX_QUANTITY_PER_LINE = 99


@dataclass(frozen=True)
class CartLine:
    """One requested line. Note what is *absent*: any price.

    The client sends product ids and quantities only. It cannot send a price, so there is nothing
    for the server to be tempted to trust — the API shape itself makes rule 1 hard to violate.
    """

    product_id: int
    quantity: int


def _validate_lines(lines: list[CartLine]) -> dict[int, int]:
    """Collapse the request into {product_id: quantity}, rejecting anything malformed.

    Merging duplicates rather than erroring on them matters for correctness, not politeness: the
    unique index on (order_id, product_id) would reject two lines for one product, but more
    importantly the row-lock takes one lock per product, so two unmerged lines would each be
    validated against the full stock and together could oversell it.
    """
    if not lines:
        raise ValidationError("Your cart is empty.")
    if len(lines) > MAX_LINE_ITEMS:
        raise ValidationError(f"An order cannot contain more than {MAX_LINE_ITEMS} products.")

    quantities: dict[int, int] = {}
    for line in lines:
        if line.quantity < 1:
            raise ValidationError("Quantity must be at least 1.")
        if line.quantity > MAX_QUANTITY_PER_LINE:
            raise ValidationError(
                f"Quantity cannot exceed {MAX_QUANTITY_PER_LINE} for a single product."
            )
        quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity

    for product_id, quantity in quantities.items():
        if quantity > MAX_QUANTITY_PER_LINE:
            raise ValidationError(
                f"Quantity cannot exceed {MAX_QUANTITY_PER_LINE} for a single product.",
                product_id=product_id,
            )

    return quantities


async def _lock_products(session: AsyncSession, product_ids: list[int]) -> dict[int, Product]:
    """Lock the given product rows for update, in ascending id order.

    `with_for_update()` makes concurrent transactions queue on these rows instead of both reading
    the same stock value. This is what turns a lost-update race into a serialised sequence.

    **The ordering is not cosmetic.** Two carts holding products {1,2} and {2,1} would deadlock if
    each locked in its own request order; ascending id gives every transaction the same lock
    order, so one simply waits.
    """
    stmt = select(Product).where(Product.id.in_(product_ids)).order_by(Product.id).with_for_update()
    products = (await session.execute(stmt)).scalars().all()
    return {p.id: p for p in products}


async def create_order(session: AsyncSession, *, user: User, lines: list[CartLine]) -> Order:
    """Create an order, reserving stock atomically.

    Everything from the lock to the commit is one transaction. If any line fails validation, the
    rollback releases both the locks and any decrement already applied — an order is never
    half-reserved.

    Stock is reserved at *creation*, before payment, not at payment. That is a real trade-off: it
    means an abandoned checkout holds inventory until the Stripe session expires. The alternative,
    reserving on payment, oversells whenever two people pay within the same instant. Holding early
    and releasing on `expired`/`cancelled` is the behaviour customers expect from a checkout, and
    the expiry path is handled by the webhook.
    """
    quantities = _validate_lines(lines)
    product_ids = sorted(quantities)

    products = await _lock_products(session, product_ids)

    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise NotFoundError(
            "One or more products in your cart no longer exist.", product_ids=missing
        )

    subtotal_cents = 0
    items: list[OrderItem] = []
    currency = "INR"

    for product_id in product_ids:
        product = products[product_id]
        quantity = quantities[product_id]

        if not product.is_active:
            raise ConflictError(f"“{product.name}” is no longer available.")

        if product.stock < quantity:
            raise InsufficientStockError(product.name, quantity, product.stock)

        product.stock -= quantity
        currency = product.currency

        # The price comes from the row we just locked — never from the request. This single line
        # is rule 1, and it is why the client is not given anywhere to put a price.
        line_total = product.price_cents * quantity
        subtotal_cents += line_total

        items.append(
            OrderItem(
                product_id=product.id,
                quantity=quantity,
                # Snapshotted, so a later price edit cannot rewrite this order (D-006).
                unit_price_cents=product.price_cents,
                product_name=product.name,
            )
        )

    order = Order(
        user_id=user.id,
        status=OrderStatus.PENDING_PAYMENT,
        subtotal_cents=subtotal_cents,
        # Equal to the subtotal today. They are separate columns because tax, shipping and
        # discounts all land between them, and retrofitting that split later means a migration
        # plus a rewrite of every order query.
        total_cents=subtotal_cents,
        currency=currency,
        items=items,
    )
    session.add(order)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        # The CHECK constraint on stock is the backstop for a logic error above; reaching it
        # means the validation was wrong, so it is reported rather than swallowed.
        raise ConflictError("Your order could not be placed. Please try again.") from exc

    await session.refresh(order)
    logger.info(
        "order_created",
        extra={
            "order_id": order.id,
            "user_id": user.id,
            "total_cents": order.total_cents,
            "line_count": len(items),
        },
    )
    return await get_order(session, order.id, requester=user)


async def _release_stock(session: AsyncSession, order: Order) -> None:
    """Return an order's reserved stock to the catalogue.

    Called only when leaving a stock-holding status for a non-holding one, so it runs at most
    once per order. That single-entry rule is what makes it safe under Stripe's retries: a
    duplicate webhook finds the order already `cancelled` and the transition is rejected before
    reaching this function.
    """
    product_ids = sorted(item.product_id for item in order.items)
    products = await _lock_products(session, product_ids)

    for item in order.items:
        product = products.get(item.product_id)
        if product is not None:
            product.stock += item.quantity

    logger.info("stock_released", extra={"order_id": order.id, "products": product_ids})


async def transition_status(
    session: AsyncSession,
    order_id: int,
    *,
    new_status: OrderStatus,
    actor_id: int | None = None,
) -> Order:
    """Move an order to a new status, or raise.

    Every status change in the application funnels through here — the admin route, the Stripe
    webhook, and a customer cancelling. One implementation means the stock-release rule cannot be
    applied in one place and forgotten in another.
    """
    order = await _load_order(session, order_id)

    if new_status == order.status:
        # Idempotent no-op rather than an error. Stripe can deliver `completed` twice for reasons
        # the ledger does not cover (two events, one outcome), and the correct response to "make
        # it paid" when it is already paid is success.
        return order

    allowed = ALLOWED_TRANSITIONS[order.status]
    if new_status not in allowed:
        raise InvalidStateTransitionError(order.status.value, new_status.value)

    was_holding = order.status in STOCK_HOLDING_STATUSES
    will_hold = new_status in STOCK_HOLDING_STATUSES

    if was_holding and not will_hold:
        await _release_stock(session, order)

    previous = order.status
    order.status = new_status
    await session.commit()
    await session.refresh(order)

    logger.info(
        "order_status_changed",
        extra={
            "order_id": order.id,
            "from": previous.value,
            "to": new_status.value,
            "actor_id": actor_id,
            "stock_released": was_holding and not will_hold,
        },
    )
    return await _load_order(session, order_id)


async def _load_order(session: AsyncSession, order_id: int) -> Order:
    """Load an order with its items and buyer eagerly.

    `selectinload` rather than lazy loading: relationships are declared `lazy="raise"`, so an
    implicit load would be a runtime error. Being explicit here also keeps this to a fixed number
    of queries rather than one per line item.

    The chained `.selectinload(OrderItem.product)` is what lets a line render the product's image
    without an N+1: one extra query for all products across all items, not one per item.
    """
    order = (
        await session.execute(
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.user)
            )
        )
    ).scalar_one_or_none()

    if order is None:
        raise NotFoundError("Order not found.")
    return order


async def get_order(session: AsyncSession, order_id: int, *, requester: User | None) -> Order:
    """Fetch one order, enforcing ownership.

    `requester=None` means "skip the ownership check" and is reachable only from routes behind
    `require_admin`, plus the Stripe webhook — which is authenticated by signature rather than by
    a user.

    A customer asking for someone else's order gets **NotFoundError → 404**, deliberately. A 403
    would confirm the id exists, turning the endpoint into an oracle for counting our orders
    (D-007). To that customer, an order that is not theirs and an order that does not exist are
    indistinguishable, which is exactly right.
    """
    order = await _load_order(session, order_id)

    if requester is None or requester.role is UserRole.ADMIN:
        return order

    if order.user_id != requester.id:
        raise NotFoundError("Order not found.")

    return order


async def list_orders(
    session: AsyncSession,
    *,
    requester: User | None,
    status: str | None = None,
    user_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Order], int]:
    """List orders, scoped to the requester unless they are an admin.

    The scoping is a `WHERE` clause applied *before* pagination, not a filter applied to results
    afterwards. Filtering after the fact is the bug that produces pages that are mostly empty and,
    worse, leaks a total row count that includes other people's orders.
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    stmt = select(Order)
    count_stmt = select(func.count()).select_from(Order)

    if requester is not None and requester.role is not UserRole.ADMIN:
        stmt = stmt.where(Order.user_id == requester.id)
        count_stmt = count_stmt.where(Order.user_id == requester.id)
    elif user_id is not None:
        # Admin-only filter: "show me this customer's orders".
        stmt = stmt.where(Order.user_id == user_id)
        count_stmt = count_stmt.where(Order.user_id == user_id)

    if status:
        try:
            parsed = OrderStatus(status)
        except ValueError as exc:
            raise ValidationError(f"“{status}” is not a valid order status.") from exc
        stmt = stmt.where(Order.status == parsed)
        count_stmt = count_stmt.where(Order.status == parsed)

    total = await session.scalar(count_stmt)

    stmt = (
        stmt.options(
            selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.user)
        )
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(limit)
        .offset(offset)
    )
    orders = list((await session.execute(stmt)).scalars().all())

    return orders, int(total or 0)


async def cancel_own_order(session: AsyncSession, order_id: int, *, user: User) -> Order:
    """Let a customer cancel their own unpaid order.

    Ownership is resolved through `get_order`, so a customer cancelling someone else's order gets
    the same 404 as reading it. Only `pending_payment` is cancellable — a paid order needs a
    refund, which is an admin action with money attached, not a self-service button.
    """
    order = await get_order(session, order_id, requester=user)

    if order.status is not OrderStatus.PENDING_PAYMENT:
        raise InvalidStateTransitionError(order.status.value, OrderStatus.CANCELLED.value)

    return await transition_status(
        session, order_id, new_status=OrderStatus.CANCELLED, actor_id=user.id
    )


async def get_order_by_stripe_session(session: AsyncSession, session_id: str) -> Order | None:
    """Resolve a Stripe checkout session back to our order. Used by the webhook."""
    order = (
        await session.execute(
            select(Order)
            .where(Order.stripe_session_id == session_id)
            .options(
                selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.user)
            )
        )
    ).scalar_one_or_none()
    return order
