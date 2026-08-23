"""تجهيزات الاختبار — قاعدة SQLite في الذاكرة، بلا شبكة ولا أسرار حقيقية."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio

# تُضبط قبل أي استيراد يقرأ الإعدادات.
os.environ.setdefault("BOT_TOKEN", "12345:test-token")
os.environ.setdefault("ALLOWED_USER_ID", "6493959847")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from tracker.db.models import Base  # noqa: E402


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as s:
        yield s

    await engine.dispose()
