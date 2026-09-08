"""Catalogue business logic.

The single source of truth for what a customer may see, what an admin may change, and what
happens when a product is removed. Both the HTTP routers and the AI agent's tools call these
functions, so the rules hold for both (DECISIONS D-003).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models import Product

logger = get_logger(__name__)

MAX_PAGE_SIZE = 100


def _escape_like(value: str) -> str:
    """Escape ILIKE wildcards in user input.

    Unescaped, a search for "%" returns the whole catalogue and "_" matches any single
    character — surprising for a customer, and a small information leak on the admin listing
    that includes withdrawn products.
    """
    return value.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")


@dataclass(frozen=True)
class ProductFilters:
    """Everything the catalogue can be narrowed by.

    `include_inactive` is *not* a query parameter a customer can set. It is passed by the admin
    router only — a filter that the client could flip would make the soft-delete meaningless.
    """

    search: str | None = None
    category: str | None = None
    in_stock_only: bool = False
    include_inactive: bool = False
    min_price_cents: int | None = None
    max_price_cents: int | None = None


def _apply_filters(stmt: Select[tuple[Product]], filters: ProductFilters) -> Select[tuple[Product]]:
    if not filters.include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))

    if filters.category:
        stmt = stmt.where(Product.category == filters.category.strip().lower())

    if filters.in_stock_only:
        stmt = stmt.where(Product.stock > 0)

    if filters.min_price_cents is not None:
        stmt = stmt.where(Product.price_cents >= filters.min_price_cents)

    if filters.max_price_cents is not None:
        stmt = stmt.where(Product.price_cents <= filters.max_price_cents)

    if filters.search:
        # ILIKE over name and description. Honest about its limits: this does not scale, and the
        # scaling note says so — the fix is a tsvector column with a GIN index, or a search
        # service. At a twelve-product catalogue, adding either now would be unjustifiable.
        # The wildcards are escaped so a query containing % does not match everything.
        pattern = f"%{_escape_like(filters.search.strip())}%"
        stmt = stmt.where(or_(Product.name.ilike(pattern), Product.description.ilike(pattern)))

    return stmt


async def list_products(
    session: AsyncSession,
    *,
    filters: ProductFilters | None = None,
    limit: int = 24,
    offset: int = 0,
) -> tuple[list[Product], int]:
    """Return one page of products and the total matching the filter.

    The limit is clamped here rather than validated only at the router, because the agent's
    `list_products` tool calls this too — and a model asking for 10,000 rows should be capped by
    the same rule, not by whichever caller remembered to check.
    """
    filters = filters or ProductFilters()
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    offset = max(0, offset)

    stmt = _apply_filters(select(Product), filters)

    total = await session.scalar(
        select(func.count()).select_from(_apply_filters(select(Product), filters).subquery())
    )

    # Newest first, tie-broken by id: without the tie-break, two products created in the same
    # transaction have an undefined order and can appear on two different pages, or on neither.
    # Merchandising order first, then newest. The id tiebreak is not decoration: without a
    # total order, two rows with equal keys can swap between pages and the same product appears
    # twice, or not at all.
    stmt = (
        stmt.order_by(Product.display_order, Product.created_at.desc(), Product.id.desc())
        .limit(limit)
        .offset(offset)
    )
    products = list((await session.execute(stmt)).scalars().all())

    return products, int(total or 0)


async def get_product_by_slug(
    session: AsyncSession, slug: str, *, include_inactive: bool = False
) -> Product:
    stmt = select(Product).where(Product.slug == slug)
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))

    product = (await session.execute(stmt)).scalar_one_or_none()
    if product is None:
        raise NotFoundError(f"No product found for “{slug}”.")
    return product


async def get_product_by_id(
    session: AsyncSession, product_id: int, *, include_inactive: bool = False
) -> Product:
    stmt = select(Product).where(Product.id == product_id)
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))

    product = (await session.execute(stmt)).scalar_one_or_none()
    if product is None:
        raise NotFoundError("Product not found.")
    return product


async def find_product(session: AsyncSession, query: str) -> Product | None:
    """Best-effort lookup by slug, then exact name, then partial name.

    This exists for the AI agent: a customer asks about "the curl gel", not about
    `curl-defining-gel`. Widening the match is a *convenience*, and it deliberately stops at
    active products — the agent must not quote a price for something nobody can buy.
    """
    term = query.strip()
    if not term:
        return None

    by_slug = (
        await session.execute(
            select(Product).where(Product.slug == term.lower(), Product.is_active.is_(True))
        )
    ).scalar_one_or_none()
    if by_slug is not None:
        return by_slug

    exact_name = (
        await session.execute(
            select(Product).where(
                func.lower(Product.name) == term.lower(), Product.is_active.is_(True)
            )
        )
    ).scalar_one_or_none()
    if exact_name is not None:
        return exact_name

    escaped = _escape_like(term)
    contains = (
        await session.execute(
            select(Product)
            .where(Product.name.ilike(f"%{escaped}%"), Product.is_active.is_(True))
            .order_by(func.length(Product.name))
            .limit(1)
        )
    ).scalar_one_or_none()
    if contains is not None:
        return contains

    # Finally, every word somewhere in the name. Customers say "curl gel"; the product is
    # "Curl Defining Gel", so a contiguous substring match misses it. AND rather than OR: any
    # word matching would make "gel" return the first product containing "the".
    words = [w for w in term.split() if len(w) > 2]
    if not words:
        return None

    return (
        await session.execute(
            select(Product)
            .where(
                Product.is_active.is_(True),
                *[Product.name.ilike(f"%{_escape_like(w)}%") for w in words],
            )
            # Shortest name first: for "curl gel", "Curl Defining Gel" should beat a longer
            # product that merely happens to contain both words.
            .order_by(func.length(Product.name))
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_categories(session: AsyncSession) -> list[str]:
    result = await session.execute(
        select(Product.category)
        .where(Product.is_active.is_(True))
        .distinct()
        .order_by(Product.category)
    )
    return list(result.scalars().all())


# --- Admin operations ---------------------------------------------------------------------
# These are called only from admin-guarded routes. The guard is in the router (core/deps.py);
# these functions assume it has already run and concern themselves with correctness, not authz.
# Splitting it that way means there is exactly one place to audit who may call what.


async def create_product(session: AsyncSession, data: dict[str, object]) -> Product:
    slug = str(data["slug"])
    existing = (
        await session.execute(select(Product.id).where(Product.slug == slug))
    ).scalar_one_or_none()
    if existing is not None:
        # Checked explicitly so the caller gets "that slug is taken", not a raw 500 from the
        # unique index. The index still exists as the real guarantee against a race here.
        raise ConflictError(f"A product with the slug “{slug}” already exists.")

    # Keys are constrained by ProductCreate, which is what validated this dict.
    product = Product(**data)
    session.add(product)
    await session.commit()
    await session.refresh(product)
    logger.info("product_created", extra={"product_id": product.id, "slug": product.slug})
    return product


async def update_product(
    session: AsyncSession, product_id: int, changes: dict[str, object]
) -> Product:
    """Apply a partial update.

    `changes` comes from `model_dump(exclude_unset=True)`, so a field the client omitted is
    absent rather than None — omitting `image_url` leaves it alone; sending `null` clears it.

    The slug is deliberately not updatable: it is the public URL of the product, and silently
    changing it would 404 every existing link and bookmark.
    """
    product = await get_product_by_id(session, product_id, include_inactive=True)

    for field, value in changes.items():
        setattr(product, field, value)

    await session.commit()
    await session.refresh(product)
    logger.info("product_updated", extra={"product_id": product.id, "fields": sorted(changes)})
    return product


async def deactivate_product(session: AsyncSession, product_id: int) -> Product:
    """Soft delete.

    A hard DELETE would violate the RESTRICT foreign key from `order_items` the moment the
    product had ever been sold — and rightly so: removing a product from the catalogue must not
    erase the record of what a customer bought (DECISIONS D-006).
    """
    product = await get_product_by_id(session, product_id, include_inactive=True)
    product.is_active = False
    await session.commit()
    await session.refresh(product)
    logger.info("product_deactivated", extra={"product_id": product.id})
    return product
