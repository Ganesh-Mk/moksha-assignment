"""Admin-only endpoints.

**`require_admin` is declared on the router itself, not on each route.** That is deliberate: a
route added to this file later is protected whether or not its author remembers to protect it.
Per-route dependencies are one forgotten decorator away from an open admin endpoint, and that is
exactly the failure the brief is testing for.

The authorization suite parametrizes over every route in here and asserts a customer's token
receives 403 on all of them, so a new admin route is covered the moment it is added.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import AdminUser, DbSession, require_admin
from app.models import UserRole
from app.schemas.common import Page
from app.schemas.order import AdminOrderResponse, OrderStatusUpdate
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.schemas.stats import DashboardStats, TimeSeries, UserSummary
from app.services import order_service, product_service, stats_service
from app.services.product_service import ProductFilters

router = APIRouter(dependencies=[Depends(require_admin)])


# --- Catalogue management -----------------------------------------------------------------


@router.get(
    "/products",
    response_model=Page[ProductResponse],
    summary="List products, including deactivated ones",
    description=(
        "**Admin only.** Unlike the public listing, this includes deactivated products — an "
        "admin needs to see what they withdrew in order to restore it."
    ),
)
async def admin_list_products(
    session: DbSession,
    search: Annotated[str | None, Query(max_length=100)] = None,
    category: Annotated[str | None, Query(max_length=64)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ProductResponse]:
    products, total = await product_service.list_products(
        session,
        filters=ProductFilters(search=search, category=category, include_inactive=True),
        limit=limit,
        offset=offset,
    )
    return Page(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product",
    description="**Admin only.** Returns **409** if the slug is already taken.",
)
async def create_product(
    payload: ProductCreate, session: DbSession, _: AdminUser
) -> ProductResponse:
    product = await product_service.create_product(session, payload.model_dump())
    return ProductResponse.model_validate(product)


@router.patch(
    "/products/{product_id}",
    response_model=ProductResponse,
    summary="Update a product",
    description=(
        "**Admin only.** PATCH semantics: an omitted field is left alone, an explicit `null` "
        "clears it. The slug is immutable — it is the product's public URL, and changing it "
        "would 404 every existing link.\n\n"
        "Editing a price does **not** alter past orders: `order_items` snapshots the price at "
        "purchase time."
    ),
)
async def update_product(
    product_id: int, payload: ProductUpdate, session: DbSession, _: AdminUser
) -> ProductResponse:
    # exclude_unset is what makes "omitted" different from "explicitly null".
    changes = payload.model_dump(exclude_unset=True)
    product = await product_service.update_product(session, product_id, changes)
    return ProductResponse.model_validate(product)


@router.delete(
    "/products/{product_id}",
    response_model=ProductResponse,
    summary="Withdraw a product",
    description=(
        "**Admin only.** A **soft delete** — sets `is_active = false`. A hard delete would "
        "violate the RESTRICT foreign key from `order_items` as soon as the product had been "
        "sold, and rightly so: withdrawing a product must not erase the record of what a "
        "customer bought. Returns the updated product so the UI can reflect the new state."
    ),
)
async def deactivate_product(product_id: int, session: DbSession, _: AdminUser) -> ProductResponse:
    product = await product_service.deactivate_product(session, product_id)
    return ProductResponse.model_validate(product)


# --- Order management ---------------------------------------------------------------------


@router.get(
    "/orders",
    response_model=Page[AdminOrderResponse],
    summary="List every order",
    description=(
        "**Admin only.** All orders from all customers, with the buyer attached. The customer-"
        "facing `GET /orders` is scoped to the caller and can never return another user's order."
    ),
)
async def admin_list_orders(
    session: DbSession,
    status_filter: Annotated[str | None, Query(alias="status", max_length=32)] = None,
    user_id: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[AdminOrderResponse]:
    orders, total = await order_service.list_orders(
        session,
        requester=None,  # None means "no ownership filter" — reachable only behind require_admin
        status=status_filter,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return Page(
        items=[AdminOrderResponse.model_validate(o) for o in orders],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/orders/{order_id}",
    response_model=AdminOrderResponse,
    summary="Any order by id",
    description="**Admin only.** Unlike the customer route, this is not scoped to the caller.",
)
async def admin_get_order(order_id: int, session: DbSession, _: AdminUser) -> AdminOrderResponse:
    order = await order_service.get_order(session, order_id, requester=None)
    return AdminOrderResponse.model_validate(order)


@router.patch(
    "/orders/{order_id}/status",
    response_model=AdminOrderResponse,
    summary="Advance an order's status",
    description=(
        "**Admin only.** Transitions are validated against the state machine in "
        "`order_service`; an illegal move returns **409** naming both states. Cancelling an "
        "order that still holds stock returns that stock to the catalogue, exactly once."
    ),
)
async def update_order_status(
    order_id: int, payload: OrderStatusUpdate, session: DbSession, admin: AdminUser
) -> AdminOrderResponse:
    order = await order_service.transition_status(
        session, order_id, new_status=payload.status, actor_id=admin.id
    )
    return AdminOrderResponse.model_validate(order)


# --- Dashboard ----------------------------------------------------------------------------


@router.get(
    "/stats",
    response_model=DashboardStats,
    summary="Dashboard figures",
    description=(
        "**Admin only.** Revenue counts only orders that actually reached `paid` or "
        "`fulfilled` — a pending order is not revenue, and counting it would overstate takings "
        "by every abandoned checkout."
    ),
)
async def dashboard_stats(session: DbSession) -> DashboardStats:
    return await stats_service.dashboard_stats(session)


@router.get(
    "/stats/timeseries",
    response_model=TimeSeries,
    summary="Daily activity for the dashboard chart",
    description=(
        "**Admin only.** Four series over the last `days` days, bucketed by UTC day.\n\n"
        "**Every day in the window is returned, including empty ones.** A sparse series is how "
        "charts lie: omit the quiet days and the line joins the two either side of the gap, "
        "showing a smooth trend across a period when nothing happened.\n\n"
        "Two of the series are *flows* (revenue, orders — what happened that day) and two are "
        "*stocks* (customers, products — how many existed by the end of it). They share a "
        "response but not an axis: the dashboard plots one at a time."
    ),
)
async def stats_timeseries(
    session: DbSession,
    days: Annotated[int, Query(ge=1, le=stats_service.MAX_TIMESERIES_DAYS)] = 30,
) -> TimeSeries:
    return await stats_service.timeseries(session, days=days)


@router.get(
    "/users",
    response_model=Page[UserSummary],
    summary="Everyone with an account, and what they have bought",
    description=(
        "**Admin only.** Biggest spender first. `total_spent_cents` counts paid and fulfilled "
        "orders only — the same definition the revenue tile uses, so the two can never "
        "disagree about what a sale is.\n\n"
        "Computed as one grouped `LEFT JOIN`, not a query per user: the obvious implementation "
        "of this screen is N+1, and at a hundred customers that is a hundred round trips to "
        "render one table."
    ),
)
async def admin_list_users(
    session: DbSession,
    role: Annotated[UserRole | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[UserSummary]:
    users, total = await stats_service.list_users(session, role=role, limit=limit, offset=offset)
    return Page(items=users, total=total, limit=limit, offset=offset)
