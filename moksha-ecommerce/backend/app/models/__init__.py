"""Model package.

Importing this package must register every table on `Base.metadata` — Alembic autogenerate only
sees models that have been imported, and a model missing here silently produces an empty
migration.
"""

from app.models.base import Base, TimestampMixin

__all__ = ["Base", "TimestampMixin"]
