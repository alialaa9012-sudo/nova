"""بيئة Alembic — تقرأ رابط القاعدة من الإعدادات لا من alembic.ini."""

from __future__ import annotations

import asyncio
import ssl

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from tracker.config import get_settings
from tracker.db.models import Base

config = context.config
target_metadata = Base.metadata


def _url() -> str:
    return get_settings().async_database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # يسمح بتعديل الأعمدة على SQLite محلياً
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    settings = get_settings()
    connect_args: dict = {}
    if settings.database_requires_ssl:
        connect_args["ssl"] = ssl.create_default_context()

    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _url()

    engine = async_engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
