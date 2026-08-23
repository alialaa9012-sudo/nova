"""بناء كائن البوت والموزّع مع كل الوسطاء والمعالِجات."""

from __future__ import annotations

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from tracker.bot.handlers import habits, review, schedule, start, today
from tracker.bot.middlewares import AllowlistMiddleware, DatabaseMiddleware
from tracker.config import get_settings


def build_bot() -> Bot:
    return Bot(
        token=get_settings().bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def build_dispatcher() -> Dispatcher:
    dp = Dispatcher()

    # الترتيب مقصود: نرفض الغرباء قبل أن نفتح أي جلسة قاعدة بيانات.
    dp.update.outer_middleware(AllowlistMiddleware())
    dp.update.outer_middleware(DatabaseMiddleware())

    dp.include_router(start.build_router())
    dp.include_router(habits.build_router())
    dp.include_router(schedule.build_router())
    dp.include_router(review.build_router())
    # آخر راوتر: يلتقط النص الحر، فلا يسبق أوامر الراوترات الأخرى
    dp.include_router(today.build_router())
    return dp
