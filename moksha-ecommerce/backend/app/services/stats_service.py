"""Admin dashboard aggregates.

Kept as SQL aggregates rather than loading rows and summing in Python. At this data volume either
works; doing it in SQL means the shape does not have to change when the volume does.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, OrderStatus, Product, User, UserRole
from app.schemas.stats import DashboardStats, LowStockProduct, StatusCount

# Below this, an admin should be reordering. Deliberately a constant rather than a setting: it is
# a merchandising judgement, and a knob nobody turns is just another thing to document.
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
