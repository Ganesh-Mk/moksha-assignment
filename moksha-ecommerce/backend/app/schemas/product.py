"""Product request and response bodies."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str
    # Cents, always. The client formats for display; the API never sends a float amount, because
    # a float that survives one JSON round-trip has already lost precision.
    price_cents: int
    currency: str
    image_url: str | None
    category: str
    stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @property
    def in_stock(self) -> bool:
        return self.stock > 0


class ProductCreate(BaseModel):
    """Admin-only. Every field is validated here *and* constrained in the database."""

    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str = Field(default="", max_length=5000)
    price_cents: int = Field(ge=0, le=100_000_000, description="Integer cents. Never a float.")
    currency: str = Field(default="INR", min_length=3, max_length=3)
    image_url: str | None = Field(default=None, max_length=1024)
    category: str = Field(min_length=1, max_length=64)
    stock: int = Field(ge=0, le=1_000_000)
    is_active: bool = True

    @field_validator("category")
    @classmethod
    def normalise_category(cls, value: str) -> str:
        # Normalised on write so filtering can be an exact indexed match rather than a case
        # -insensitive comparison, which would not use the index.
        return value.strip().lower()


class ProductUpdate(BaseModel):
    """PATCH semantics: every field optional, and *unset* is distinct from *null*.

    `model_dump(exclude_unset=True)` is what makes that distinction real — without it, omitting
    `image_url` would be indistinguishable from explicitly clearing it.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    price_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    image_url: str | None = Field(default=None, max_length=1024)
    category: str | None = Field(default=None, min_length=1, max_length=64)
    stock: int | None = Field(default=None, ge=0, le=1_000_000)
    is_active: bool | None = None

    @field_validator("category")
    @classmethod
    def normalise_category(cls, value: str | None) -> str | None:
        return value.strip().lower() if value is not None else None
