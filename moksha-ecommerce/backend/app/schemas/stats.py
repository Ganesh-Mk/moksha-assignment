"""Admin dashboard figures."""

from __future__ import annotations

from pydantic import BaseModel, Field


class StatusCount(BaseModel):
    status: str
    count: int


class LowStockProduct(BaseModel):
    id: int
    name: str
    slug: str
    stock: int


class DashboardStats(BaseModel):
    """Deliberately small. Every figure here answers a question an operator actually asks."""

    total_revenue_cents: int = Field(
        description=(
            "Sum of totals for orders that reached paid or fulfilled. Pending orders are not "
            "revenue — counting them would overstate takings by every abandoned checkout."
        )
    )
    paid_order_count: int
    total_order_count: int
    customer_count: int
    orders_by_status: list[StatusCount]
    low_stock: list[LowStockProduct] = Field(
        description="Active products at or below the low-stock threshold, scarcest first."
    )
