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


@pytest_asyncio.fixture
async def wired(monkeypatch):
    """موزّع aiogram حقيقي موصول بقاعدة مشتركة في الذاكرة وببوت لا يلمس الشبكة.

    يعيد (dispatcher, bot, recorder) — والـrecorder يحمل كل ما كان سيُرسل.
    """
    from sqlalchemy.pool import StaticPool

    from tracker.db import session as session_module
    from tracker.tests.fake_telegram import make_bot

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    monkeypatch.setattr(session_module, "_engine", engine)
    monkeypatch.setattr(
        session_module,
        "_sessionmaker",
        async_sessionmaker(engine, expire_on_commit=False),
    )

    from tracker.bot.setup import build_dispatcher

    bot, recorder = make_bot()
    yield build_dispatcher(), bot, recorder

    await engine.dispose()
