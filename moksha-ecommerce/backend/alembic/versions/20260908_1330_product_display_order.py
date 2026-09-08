"""Add products.display_order

Merchandising order is a decision, not an accident of insert order. Before this the shop was
sorted by `created_at DESC`, which put whichever products were seeded last at the front.

Revision ID: 7c1f2a9d4e10
Revises: 03b0a96f0867
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "7c1f2a9d4e10"
down_revision: str | None = "03b0a96f0867"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `server_default` so the column can be NOT NULL on a table that already has rows; existing
    # products land in the middle of the order rather than jumping to the front.
    op.add_column(
        "products",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="100"),
    )
    op.create_index("ix_products_display_order", "products", ["display_order", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_products_display_order", table_name="products")
    op.drop_column("products", "display_order")
