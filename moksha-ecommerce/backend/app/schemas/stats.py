"""Admin dashboard figures."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import UserRole


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


class TimeSeriesPoint(BaseModel):
    """One day.

    Two of these four numbers are *flows* and two are *stocks*, which is why the UI plots one
    series at a time rather than overlaying them: revenue and orders are "what happened that day",
    customers and products are "how many existed by the end of it". Sharing one y-axis between a
    daily count and a running total draws a picture that is simply untrue.
    """

    date: date
    revenue_cents: int = Field(description="Paid and fulfilled orders placed that day.")
    orders: int = Field(description="Orders placed that day, whatever their status.")
    customers: int = Field(description="Running total of customer accounts at end of day.")
    products: int = Field(description="Running total of live products at end of day.")


class TimeSeries(BaseModel):
    """A dense series: every day in the window is present, including the empty ones.

    Omitting days with no activity would let the chart join 1 January to 20 March with a straight
    line and call it a trend.
    """

    start: date
    end: date
    points: list[TimeSeriesPoint]


class UserSummary(BaseModel):
    """A user with their purchase history folded in."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    picture_url: str | None
    role: UserRole
    created_at: datetime

    order_count: int = Field(description="Every order they have placed, in any state.")
    paid_order_count: int
    total_spent_cents: int = Field(
        description=(
            "Counts paid and fulfilled orders only — the same definition the revenue tile uses, "
            "so the customer column and the headline figure can never disagree."
        )
    )
    last_order_at: datetime | None
