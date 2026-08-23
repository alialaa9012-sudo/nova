"""أوامر التعريف الأساسية: /start و/help."""

from __future__ import annotations

from datetime import date

from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import User
from tracker.services.bootstrap import current_schedule
from tracker.services.timeutil import format_arabic_date, format_time

HELP_TEXT = """<b>الأوامر المتاحة</b>

/today — رسالة اليوم
/مواعيد — تغيير مواعيد الرسائل
/dict — قاموس الجمل الإنجليزية
/week — تقرير الأسبوع
/month — تقرير الشهر
/pause — إيقاف الإشعارات مؤقتاً
/export — تصدير كل بياناتك
/help — هذه القائمة"""


async def handle_start(
    message: Message,
    session: AsyncSession,
    user: User,
    is_new_user: bool,
    today: date,
) -> None:
    name = user.first_name or "صديقي"
    schedule = await current_schedule(session, user.id, today)

    if is_new_user:
        lines = [
            f"أهلاً {name} 👋",
            "",
            "أنا مساعدك اليومي. هظبط لك يومك في رسالة واحدة، وتخلّص مهامك بلمسة.",
            "",
            f"<b>اليوم:</b> {format_arabic_date(today)}",
        ]
        if schedule:
            lines += [
                "",
                "<b>مواعيدك المبدئية</b>",
                f"• رسالة اليوم — {format_time(schedule.morning_time)}",
                f"• تذكير بالناقص — {format_time(schedule.midday_time)}"
                if schedule.midday_time
                else "• تذكير بالناقص — متوقّف",
                f"• المراجعة الليلية — {format_time(schedule.review_time)}",
                "",
                "تقدر تغيّرها في أي وقت بأمر /مواعيد.",
            ]
        lines += ["", "اكتب /help لكل الأوامر."]
    else:
        lines = [
            f"أهلاً {name} 👋",
            "",
            f"<b>اليوم:</b> {format_arabic_date(today)}",
            "",
            "اكتب /today لرسالة اليوم، أو /help لكل الأوامر.",
        ]

    await message.answer("\n".join(lines))


async def handle_help(message: Message) -> None:
    await message.answer(HELP_TEXT)


def build_router() -> Router:
    """راوتر جديد في كل نداء — الراوتر الواحد لا يُربط بأكثر من موزّع."""
    router = Router(name="start")
    router.message.register(handle_start, CommandStart())
    router.message.register(handle_help, Command("help"))
    return router
