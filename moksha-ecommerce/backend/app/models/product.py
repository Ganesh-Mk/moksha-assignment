"""Catalogue."""

from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Slug rather than id in URLs: readable, shareable, and stable if ids ever change. Unique so
    # `/products/{slug}` resolves to exactly one row.
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Money is an integer number of cents — never a float (DECISIONS D-004). Floats cannot
    # represent 0.10 exactly, and the error surfaces as an order total off by a cent.
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    image_url: Mapped[str | None] = mapped_column(String(1024))
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Soft delete. A hard DELETE would break the FK from `order_items`, and order history must
    # outlive the catalogue — an admin removing a product cannot erase what someone bought.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    __table_args__ = (
        # The database is the last line of defence for these. The service validates them too, but
        # a constraint here also protects the seed script, a migration, and anyone with psql.
        CheckConstraint("price_cents >= 0", name="price_non_negative"),
        CheckConstraint("stock >= 0", name="stock_non_negative"),
        # Covers the default listing: active products filtered by category. Without it, the
        # catalogue page is a sequential scan that gets slower as the catalogue grows.
        Index("ix_products_active_category", "is_active", "category"),
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} slug={self.slug!r} stock={self.stock}>"
