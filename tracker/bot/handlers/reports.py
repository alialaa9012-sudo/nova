"""تقارير الأسبوع والشهر، عند الطلب أو تلقائياً مع المراجعة."""

from __future__ import annotations

from datetime import date

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import User
from tracker.services import habits as habit_service
from tracker.services import progress as progress_service
from tracker.services.render import render_period
from tracker.services.timeutil import month_bounds, week_bounds

WEEKLY_TITLE = "📊 <b>ملخص الأسبوع</b>"
MONTHLY_TITLE = "🗓 <b>ملخص الشهر</b>"


async def build_weekly(
    session: AsyncSession, user: User, day: date
) -> str:
    start, end = week_bounds(day, user.week_start)
    current, previous = await progress_service.compare(session, user, start, end)

    entries = await habit_service.vocab_entries(session, user, since=start, until=end)

    return render_period(
        current,
        title=WEEKLY_TITLE,
        tasks_note=progress_service.delta_note(current.tasks_pct, previous.tasks_pct),
        habits_note=progress_service.delta_note(current.habits_pct, previous.habits_pct),
        sentences=[e.content for e in reversed(entries)],
    )


async def build_monthly(session: AsyncSession, user: User, day: date) -> str:
    start, end = month_bounds(day)
    current, previous = await progress_service.compare(session, user, start, end)

    return render_period(
        current,
        title=MONTHLY_TITLE,
        tasks_note=progress_service.delta_note(current.tasks_pct, previous.tasks_pct),
        habits_note=progress_service.delta_note(current.habits_pct, previous.habits_pct),
    )


async def handle_week(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    await message.answer(await build_weekly(session, user, today))


async def handle_month(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    await message.answer(await build_monthly(session, user, today))


def build_router() -> Router:
    router = Router(name="reports")
    router.message.register(handle_week, Command("week"))
    router.message.register(handle_month, Command("month"))
    return router
