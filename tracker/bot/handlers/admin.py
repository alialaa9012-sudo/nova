"""أوامر التحكّم: وضع الإجازة، والتصدير."""

from __future__ import annotations

from datetime import date

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import BufferedInputFile, Message
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.config import get_settings
from tracker.db.models import User
from tracker.services import export as export_service
from tracker.services import scheduling


async def handle_pause(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    if user.is_paused:
        await message.answer("الإشعارات متوقّفة أصلاً. اكتب /resume لتشغيلها.")
        return

    user.is_paused = True
    await session.flush()
    await scheduling.cancel_day(session, user, today)

    await message.answer(
        "⏸ وقّفت كل الإشعارات التلقائية.\n"
        "<i>البوت لسه شغّال — تقدر تفتح /today وتسجّل عادي.</i>\n\n"
        "لما ترجع اكتب /resume."
    )


async def handle_resume(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    if not user.is_paused:
        await message.answer("الإشعارات شغّالة بالفعل.")
        return

    user.is_paused = False
    await session.flush()
    created = await scheduling.ensure_horizon(session, user, today, get_settings().tz)

    await message.answer(
        f"▶️ رجّعت الإشعارات. جهّزت {len(created)} تذكير للأيام الجاية."
    )


async def handle_export(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    data = await export_service.collect(session, user)
    stamp = today.isoformat()

    await message.answer(export_service.summarize(data))
    await message.answer_document(
        BufferedInputFile(
            export_service.to_json(data), filename=f"daily-tracker-{stamp}.json"
        ),
        caption="كل بياناتك بصيغة JSON.",
    )

    for table in ("task_instances", "habit_logs", "vocab_entries"):
        rows = data.get(table) or []
        if not rows:
            continue
        await message.answer_document(
            BufferedInputFile(
                export_service.to_csv(rows), filename=f"{table}-{stamp}.csv"
            )
        )


def build_router() -> Router:
    router = Router(name="admin")
    router.message.register(handle_pause, Command("pause"))
    router.message.register(handle_resume, Command("resume"))
    router.message.register(handle_export, Command("export"))
    return router
