"""بناء كائن البوت والموزّع مع كل الوسطاء والمعالِجات."""

from __future__ import annotations

import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import BotCommand, ErrorEvent

from tracker.bot.handlers import (
    admin,
    events,
    habits,
    reports,
    review,
    schedule,
    start,
    today,
)
from tracker.bot.middlewares import AllowlistMiddleware, DatabaseMiddleware
from tracker.config import get_settings

logger = logging.getLogger(__name__)

BOT_COMMANDS = [
    BotCommand(command="today", description="رسالة اليوم"),
    BotCommand(command="review", description="مراجعة اليوم"),
    BotCommand(command="event", description="إضافة حدث"),
    BotCommand(command="events", description="الأحداث القادمة"),
    BotCommand(command="note", description="ملخص سريع لليوم"),
    BotCommand(command="dict", description="قاموس الجمل الإنجليزية"),
    BotCommand(command="times", description="مواعيد الرسائل"),
    BotCommand(command="week", description="ملخص الأسبوع"),
    BotCommand(command="month", description="ملخص الشهر"),
    BotCommand(command="pause", description="إيقاف الإشعارات"),
    BotCommand(command="resume", description="تشغيل الإشعارات"),
    BotCommand(command="export", description="تصدير بياناتك"),
    BotCommand(command="cancel", description="إلغاء الانتظار"),
    BotCommand(command="help", description="كل الأوامر"),
]


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
    dp.include_router(reports.build_router())
    dp.include_router(events.build_router())
    dp.include_router(admin.build_router())

    dp.errors.register(handle_error)
    # آخر راوتر: يلتقط النص الحر، فلا يسبق أوامر الراوترات الأخرى
    dp.include_router(today.build_router())
    return dp


async def handle_error(event: ErrorEvent) -> bool:
    """أي خطأ غير متوقّع يُسجَّل ويُبلَّغ به المستخدم برسالة مفهومة.

    الابتلاع مقصود: خطأ في معالج واحد يجب ألا يُسقط الـwebhook كله، وإلا
    أعاد تليجرام إرسال نفس التحديث في حلقة لا تنتهي.
    """
    logger.exception("خطأ أثناء معالجة تحديث", exc_info=event.exception)

    message = getattr(event.update, "message", None)
    query = getattr(event.update, "callback_query", None)
    text = "حصل خطأ غير متوقّع. جرّب تاني، ولو تكرر اكتب /today."

    try:
        if query is not None:
            await query.answer(text, show_alert=True)
        elif message is not None:
            await message.answer(text)
    except Exception:  # pragma: no cover - الإبلاغ نفسه قد يفشل
        logger.exception("تعذّر إبلاغ المستخدم بالخطأ")

    return True
