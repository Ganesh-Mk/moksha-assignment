"""Admin dashboard aggregates.

Kept as SQL aggregates rather than loading rows and summing in Python. At this data volume either
works; doing it in SQL means the shape does not have to change when the volume does.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import NamedTuple

from sqlalchemy import ColumnElement, case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import InstrumentedAttribute

from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models import Order, OrderStatus, Product, User, UserRole
from app.schemas.stats import (
    DashboardStats,
    LowStockProduct,
    StatusCount,
    TimeSeries,
    TimeSeriesPoint,
    UserSummary,
)

# Below this, an admin should be reordering. Deliberately a constant rather than a setting: it is
# a merchandising judgement, and a knob nobody turns is just another thing to document.
logger = get_logger(__name__)

LOW_STOCK_THRESHOLD = 10

# Only these two states represent money actually taken.
REVENUE_STATUSES = (OrderStatus.PAID, OrderStatus.FULFILLED)


async def dashboard_stats(session: AsyncSession) -> DashboardStats:
    revenue = await session.scalar(
        select(func.coalesce(func.sum(Order.total_cents), 0)).where(
            Order.status.in_(REVENUE_STATUSES)
        )
    )
    paid_count = await session.scalar(
        select(func.count()).select_from(Order).where(Order.status.in_(REVENUE_STATUSES))
    )
    total_count = await session.scalar(select(func.count()).select_from(Order))
    customer_count = await session.scalar(
        select(func.count()).select_from(User).where(User.role == UserRole.CUSTOMER)
    )

    by_status = (
        await session.execute(
            select(Order.status, func.count()).group_by(Order.status).order_by(Order.status)
        )
    ).all()

    low_stock = (
        (
            await session.execute(
                select(Product)
                .where(Product.is_active.is_(True), Product.stock <= LOW_STOCK_THRESHOLD)
                .order_by(Product.stock, Product.name)
                .limit(10)
            )
        )
        .scalars()
        .all()
    )

    return DashboardStats(
        total_revenue_cents=int(revenue or 0),
        paid_order_count=int(paid_count or 0),
        total_order_count=int(total_count or 0),
        customer_count=int(customer_count or 0),
        orders_by_status=[StatusCount(status=s.value, count=c) for s, c in by_status],
        low_stock=[
            LowStockProduct(id=p.id, name=p.name, slug=p.slug, stock=p.stock) for p in low_stock
        ],
    )


# A window longer than this is a reporting job, not a dashboard widget — it would also start
# returning enough points that the chart draws more line segments than the screen has pixels.
MAX_TIMESERIES_DAYS = 365


async def timeseries(session: AsyncSession, *, days: int) -> TimeSeries:
    """Daily activity over the last `days` days, ending today.

    **Every day in the window is returned, including days with no activity.** A sparse series is
    the classic way to draw a lie: the chart joins the two days either side of a gap and shows a
    smooth trend across a period when nothing happened.

    Bucketing is by UTC day, which is what `created_at` is stored in. For a single-region shop the
    honest fix is to bucket in the shop's timezone; doing that properly means knowing what that
    timezone is, and inventing one here would be worse than being explicit about UTC.
    """
    today = datetime.now(UTC).date()
    start = today - timedelta(days=days - 1)
    # Compared against a timezone-aware bound rather than casting the column to a date, so the
    # index on created_at stays usable.
    window_start = datetime.combine(start, time.min, tzinfo=UTC)

    day = func.date(func.timezone("UTC", Order.created_at))
    rows = (
        await session.execute(
            select(
                day.label("day"),
                func.count().label("orders"),
                func.coalesce(
                    func.sum(
                        case(
                            (Order.status.in_(REVENUE_STATUSES), Order.total_cents),
                            else_=0,
                        )
                    ),
                    0,
                ).label("revenue"),
            )
            .where(Order.created_at >= window_start)
            .group_by(day)
        )
    ).all()
    by_day = {r.day: (int(r.orders), int(r.revenue)) for r in rows}

    customers = await _running_total(
        session, User.created_at, window_start, extra=(User.role == UserRole.CUSTOMER,)
    )
    products = await _running_total(
        session, Product.created_at, window_start, extra=(Product.is_active.is_(True),)
    )

    points: list[TimeSeriesPoint] = []
    customers_so_far = customers.opening
    products_so_far = products.opening
    for offset in range(days):
        current = start + timedelta(days=offset)
        customers_so_far += customers.added.get(current, 0)
        products_so_far += products.added.get(current, 0)
        orders, revenue = by_day.get(current, (0, 0))
        points.append(
            TimeSeriesPoint(
                date=current,
                revenue_cents=revenue,
                orders=orders,
                customers=customers_so_far,
                products=products_so_far,
            )
        )

    return TimeSeries(start=start, end=today, points=points)


class _Cumulative(NamedTuple):
    """How many existed before the window, and how many appeared on each day inside it."""

    opening: int
    added: dict[date, int]


async def _running_total(
    session: AsyncSession,
    column: InstrumentedAttribute[datetime],
    window_start: datetime,
    *,
    extra: tuple[ColumnElement[bool], ...],
) -> _Cumulative:
    """The two queries a running total needs: the opening balance, then the daily additions.

    Two queries rather than one window function because the opening balance is a single scalar
    over the whole table's history — expressing it as a window over the windowed rows would mean
    scanning every row ever created just to reach a number the count already knows.
    """
    entity = column.parent.entity
    opening = await session.scalar(
        select(func.count()).select_from(entity).where(column < window_start, *extra)
    )

    day = func.date(func.timezone("UTC", column))
    rows = (
        await session.execute(
            select(day.label("day"), func.count().label("added"))
            .select_from(entity)
            .where(column >= window_start, *extra)
            .group_by(day)
        )
    ).all()

    return _Cumulative(opening=int(opening or 0), added={r.day: int(r.added) for r in rows})


async def list_users(
    session: AsyncSession,
    *,
    role: UserRole | None = None,
    only_user_id: int | None = None,
    limit: int,
    offset: int,
) -> tuple[list[UserSummary], int]:
    """Every user with their purchase history folded in, biggest spender first.

    One grouped LEFT JOIN rather than a query per user: the obvious implementation of this screen
    is N+1, and at a hundred customers that is a hundred round trips to render one table.

    `total_spent_cents` counts paid and fulfilled orders only — the same definition
    `dashboard_stats` uses for revenue. Two figures on one screen that disagree about what a sale
    is are worse than one figure.
    """
    conditions = []
    if role is not None:
        conditions.append(User.role == role)
    if only_user_id is not None:
        # Re-reading one row through the same aggregate is what keeps the response after a
        # deactivate identical in shape to a row in the table it came from.
        conditions.append(User.id == only_user_id)

    total = await session.scalar(select(func.count()).select_from(User).where(*conditions))

    paid = Order.status.in_(REVENUE_STATUSES)
    rows = (
        await session.execute(
            select(
                User,
                func.count(Order.id).label("order_count"),
                func.count(case((paid, Order.id))).label("paid_order_count"),
                func.coalesce(func.sum(case((paid, Order.total_cents), else_=0)), 0).label(
                    "total_spent_cents"
                ),
                func.max(Order.created_at).label("last_order_at"),
            )
            .select_from(User)
            .outerjoin(Order, Order.user_id == User.id)
            .where(*conditions)
            .group_by(User.id)
            # Best customers first, and a stable tiebreak so pagination cannot repeat or skip a
            # row when several users have spent nothing.
            .order_by(desc("total_spent_cents"), desc(User.created_at), User.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return [
        UserSummary(
            id=user.id,
            email=user.email,
            name=user.name,
            picture_url=user.picture_url,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            order_count=int(order_count),
            paid_order_count=int(paid_order_count),
            total_spent_cents=int(total_spent_cents),
            last_order_at=last_order_at,
        )
        for user, order_count, paid_order_count, total_spent_cents, last_order_at in rows
    ], int(total or 0)


async def set_user_active(
    session: AsyncSession, user_id: int, *, is_active: bool, actor: User
) -> UserSummary:
    """Disable or restore an account.

    **A soft delete, exactly like a withdrawn product.** A hard `DELETE` would either orphan the
    customer's orders or cascade them away, and an order has to survive as a financial record
    whatever happens to the account — the `orders.user_id` foreign key is what makes "who bought
    this" answerable a year later. Disabling is what "delete" means here, and the user model has
    said so since Phase 1.

    Two guards, both about not locking everyone out of the admin console:

    * an admin cannot disable **themselves** — the single most likely misclick on this screen;
    * the **last active admin** cannot be disabled, or there is nobody left who can undo it.

    Restoring is the same call with `is_active=True`, so the action is reversible from the same
    screen. That is the difference between a soft delete and a mistake.
    """
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found.")

    if not is_active:
        if user.id == actor.id:
            raise ConflictError("You cannot disable your own account.")

        if user.role is UserRole.ADMIN:
            remaining = await session.scalar(
                select(func.count())
                .select_from(User)
                .where(User.role == UserRole.ADMIN, User.is_active.is_(True), User.id != user.id)
            )
            if not remaining:
                raise ConflictError(
                    "This is the last active admin. Promote someone else before disabling it."
                )

    user.is_active = is_active
    await session.commit()
    await session.refresh(user)

    logger.info(
        "user_active_changed",
        extra={"actor_id": actor.id, "user_id": user.id, "is_active": is_active},
    )

    summary, _ = await list_users(session, limit=1, offset=0, only_user_id=user.id)
    return summary[0]
