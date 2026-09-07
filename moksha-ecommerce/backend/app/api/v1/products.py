"""Public catalogue endpoints.

Read-only and public. Every *write* to the catalogue lives under `/admin/products` behind
`require_admin` — keeping them on separate routers means the auth posture of a route is visible
from its path, and a new read endpoint added here cannot accidentally inherit write access.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import DbSession
from app.schemas.common import Page
from app.schemas.product import ProductResponse
from app.services import product_service
from app.services.product_service import ProductFilters

router = APIRouter()


@router.get(
    "",
    response_model=Page[ProductResponse],
    summary="List products",
    description=(
        "**Public.** Active products only — a deactivated product is invisible here regardless of "
        "any query parameter, because `include_inactive` is not client-settable. Admins see "
        "everything via `GET /admin/products`.\n\n"
        "Prices are integer **cents**."
    ),
)
async def list_products(
    session: DbSession,
    search: Annotated[
        str | None, Query(max_length=100, description="Matches name or description.")
    ] = None,
    category: Annotated[str | None, Query(max_length=64)] = None,
    in_stock_only: Annotated[bool, Query()] = False,
    min_price_cents: Annotated[int | None, Query(ge=0)] = None,
    max_price_cents: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ProductResponse]:
    products, total = await product_service.list_products(
        session,
        filters=ProductFilters(
            search=search,
            category=category,
            in_stock_only=in_stock_only,
            min_price_cents=min_price_cents,
            max_price_cents=max_price_cents,
        ),
        limit=limit,
        offset=offset,
    )
    return Page(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/categories",
    response_model=list[str],
    summary="Distinct categories",
    description=(
        "**Public.** Drives the catalogue filter. Declared *before* `/{slug}` — FastAPI matches "
        "in declaration order, so the reverse would make this resolve as a product named "
        '"categories".'
    ),
)
async def list_categories(session: DbSession) -> list[str]:
    return await product_service.list_categories(session)


@router.get(
    "/{slug}",
    response_model=ProductResponse,
    summary="One product by slug",
    description=(
        "**Public.** Returns **404** for an unknown *or deactivated* product — from outside, a "
        "product that has been withdrawn is indistinguishable from one that never existed."
    ),
)
async def get_product(slug: str, session: DbSession) -> ProductResponse:
    product = await product_service.get_product_by_slug(session, slug)
    return ProductResponse.model_validate(product)
