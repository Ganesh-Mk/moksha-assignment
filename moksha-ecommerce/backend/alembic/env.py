"""Alembic environment.

The DSN comes from `app.config`, not from alembic.ini, so there is exactly one place the
database is named and migrations cannot run against a different database than the app.

psycopg 3 drives both the async app and these sync migrations (D-001), so this file runs the
plain synchronous engine — no asyncio bridging needed.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.models import Base  # noqa: F401 — importing the package registers every model

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _sync_url() -> str:
    """The DSN migrations run against, normalised for the sync driver.

    `MIGRATION_DATABASE_URL` wins when set. On a managed Postgres that means pointing migrations
    at the *direct* endpoint while the application keeps using the pooled one — DDL and a
    transaction pooler are a bad combination, and the failure is intermittent rather than loud.
    """
    url = settings.migration_database_url or settings.database_url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url.replace("+asyncpg", "+psycopg")


config.set_main_option("sqlalchemy.url", _sync_url())

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Without compare_type, a column changed from VARCHAR(50) to VARCHAR(120) produces
            # an empty migration and the drift goes unnoticed until a write fails in production.
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
