"""Customer order endpoints.

Every route here requires authentication, and every one is scoped to the caller. The scoping is
done in `order_service`, not here — the AI agent reaches the same functions, so a check placed in
this router would protect the API and leave the agent open.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.common import Page
from app.schemas.order import OrderCreate, OrderResponse
from app.services import order_service
from app.services.order_service import CartLine

router = APIRouter()


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Place an order",
    description=(
        "**Authenticated.** Creates an order in `pending_payment` and reserves stock.\n\n"
        "**The total is computed server-side from database prices.** The request body carries "
        "product ids and quantities only — there is no field for an amount, so a client cannot "
        "propose one.\n\n"
        "Stock is validated and decremented inside a single transaction holding "
        "`SELECT … FOR UPDATE` on the product rows, so two concurrent orders for the last unit "
        "cannot both succeed. Returns **409** with the available quantity when stock is short.\n\n"
        "Stock is reserved now rather than at payment: reserving at payment oversells whenever "
        "two customers pay in the same instant. An abandoned checkout releases its hold when "
        "Stripe reports the session expired."
    ),
)
async def create_order(
    payload: OrderCreate, session: DbSession, user: CurrentUser
) -> OrderResponse:
    order = await order_service.create_order(
        session,
        user=user,
        lines=[CartLine(product_id=i.product_id, quantity=i.quantity) for i in payload.items],
    )
    return OrderResponse.model_validate(order)


@router.get(
    "",
    response_model=Page[OrderResponse],
    summary="My orders",
    description=(
        "**Authenticated.** Returns only the caller's own orders. The ownership filter is a "
        "`WHERE` clause applied before pagination, so `total` counts the caller's orders and "
        "never leaks how many exist overall."
    ),
)
async def list_my_orders(
    session: DbSession,
    user: CurrentUser,
    status_filter: Annotated[str | None, Query(alias="status", max_length=32)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[OrderResponse]:
    orders, total = await order_service.list_orders(
        session, requester=user, status=status_filter, limit=limit, offset=offset
    )
    return Page(
        items=[OrderResponse.model_validate(o) for o in orders],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="One of my orders",
    description=(
        "**Authenticated, owner only.**\n\n"
        "Another customer's order returns **404, not 403** — a 403 would confirm the id exists "
        "and turn this endpoint into an oracle for counting our orders. To a customer, an order "
        "that is not theirs is indistinguishable from one that does not exist.\n\n"
        "Admins read any order via `GET /admin/orders/{order_id}`."
    ),
)
async def get_my_order(order_id: int, session: DbSession, user: CurrentUser) -> OrderResponse:
    order = await order_service.get_order(session, order_id, requester=user)
    return OrderResponse.model_validate(order)


@router.post(
    "/{order_id}/cancel",
    response_model=OrderResponse,
    summary="Cancel an unpaid order",
    description=(
        "**Authenticated, owner only.** Cancels a `pending_payment` order and returns its "
        "reserved stock to the catalogue.\n\n"
        "Only unpaid orders can be cancelled here. A paid order needs a refund — that is money "
        "moving, so it is an admin action, not a self-service button. Returns **409** naming "
        "both states if the order is past `pending_payment`, and **404** if it is not yours."
    ),
)
async def cancel_my_order(order_id: int, session: DbSession, user: CurrentUser) -> OrderResponse:
    order = await order_service.cancel_own_order(session, order_id, user=user)
    return OrderResponse.model_validate(order)
