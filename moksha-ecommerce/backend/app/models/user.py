"""User identity and role."""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.order import Order


class UserRole(enum.StrEnum):
    """Two roles is the whole model. A third would need a real permission table.

    `StrEnum` so the value serialises as `"admin"` in JSON and in the JWT claim without a custom
    encoder, and so comparisons against a decoded token work directly.
    """

    CUSTOMER = "customer"
    ADMIN = "admin"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Google's stable subject identifier — the real primary identity. Email is unique too, but a
    # Google account can change its email address while `sub` never changes, so matching on
    # `sub` is what keeps a returning user attached to their existing orders.
    google_sub: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    picture_url: Mapped[str | None] = mapped_column(String(1024))

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        default=UserRole.CUSTOMER,
        nullable=False,
    )

    # Soft disable. Deleting a user would orphan their orders, and an order must survive as a
    # financial record regardless of what happens to the account.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    orders: Mapped[list[Order]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="raise"
    )

    __table_args__ = (
        # The admin list screen sorts by role then creation; this covers it without a sort step.
        Index("ix_users_role_created_at", "role", "created_at"),
    )

    @property
    def is_admin(self) -> bool:
        return self.role is UserRole.ADMIN

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role.value}>"
