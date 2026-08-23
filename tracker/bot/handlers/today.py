"""رسالة اليوم: عرضها، تحديثها في مكانها، وإضافة المهام إليها."""

from __future__ import annotations

import logging
from datetime import date

from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.bot.keyboards import DayCB, TaskCB, today_keyboard
from tracker.config import get_settings
from tracker.db.models import Recurrence, User
from tracker.services import habits as habit_service
from tracker.services import tasks as task_service
from tracker.bot.handlers.habits import consume_pending_vocab
from tracker.bot.handlers.review import consume_pending_note, handle_note_command
from tracker.bot.handlers.schedule import consume_pending_time
from tracker.services import notes as note_service
from tracker.services.parsing import parse_task
from tracker.services.render import render_task_added, render_today
from tracker.services.timeutil import ARABIC_WEEKDAYS, now_in

logger = logging.getLogger(__name__)

ADD_TASK_HINT = (
    "✍️ اكتب المهمة كما تحب:\n\n"
    "• <code>قراءة 20 صفحة</code>\n"
    "• <code>مذاكرة 90 دقيقة 9م</code>\n"
    "• <code>كل يوم مراجعة الإنجليزي</code>\n"
    "• <code>كل سبت جيم 6م</code>"
)


async def _today_view(session: AsyncSession, user: User, day: date) -> tuple[str, object]:
    """النص واللوحة معاً — مصدر واحد لكل مكان يعرض رسالة اليوم."""
    pairs = await task_service.day_pairs(session, user, day)
    task_done, task_total, tasks_pct = task_service.completion(pairs)
    carried = sum(1 for _, inst in pairs if inst.carried_from_date)

    habit_state = await habit_service.day_state(session, user, day)
    habit_done, habit_total, habits_pct = habit_service.completion(habit_state)

    note = await note_service.text_for(session, user, day)

    text = render_today(
        name=user.first_name or "صديقي",
        now=now_in(get_settings().tz),
        day=day,
        task_done=task_done,
        task_total=task_total,
        tasks_pct=tasks_pct,
        habit_done=habit_done,
        habit_total=habit_total,
        habits_pct=habits_pct,
        carried_count=carried,
        note=note,
    )
    return text, today_keyboard(pairs, habit_state)


async def show_today(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    text, markup = await _today_view(session, user, today)
    sent = await message.answer(text, reply_markup=markup)

    # نحفظ معرّف الرسالة لنحرّرها لاحقاً بدل إرسال رسالة جديدة كل مرة
    user.today_message_id = sent.message_id
    user.today_message_date = today


async def refresh_today(
    query: CallbackQuery, session: AsyncSession, user: User, today: date
) -> None:
    text, markup = await _today_view(session, user, today)
    try:
        await query.message.edit_text(text, reply_markup=markup)
    except TelegramBadRequest as exc:
        # تليجرام يرفض التحرير إذا لم يتغيّر شيء — وهذا ليس خطأً
        if "message is not modified" not in str(exc):
            raise


async def handle_today_command(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    await show_today(message, session, user, today)


async def handle_toggle(
    query: CallbackQuery,
    callback_data: TaskCB,
    session: AsyncSession,
    user: User,
    today: date,
) -> None:
    settings = get_settings()
    instance = await task_service.toggle(
        session, user, callback_data.instance_id, tz=settings.tz
    )
    if instance is None:
        await query.answer("لم أجد هذه المهمة.", show_alert=True)
        return

    await query.answer("تم ✅" if instance.is_done else "رجعت ⬜")
    await refresh_today(query, session, user, today)


async def handle_refresh(
    query: CallbackQuery, session: AsyncSession, user: User, today: date
) -> None:
    await query.answer()
    await refresh_today(query, session, user, today)


async def handle_add_task_prompt(query: CallbackQuery) -> None:
    await query.answer()
    await query.message.answer(ADD_TASK_HINT)


async def handle_note_prompt(
    query: CallbackQuery, session: AsyncSession, user: User
) -> None:
    await query.answer()
    await handle_note_command(query.message, session, user)


def _recurrence_note(recurrence: Recurrence, custom_days: list[int] | None) -> str | None:
    if recurrence is Recurrence.DAILY:
        return "كل يوم"
    if recurrence is Recurrence.WEEKLY:
        return "كل أسبوع"
    if recurrence is Recurrence.CUSTOM_DAYS and custom_days:
        names = "، ".join(ARABIC_WEEKDAYS[d] for d in custom_days)
        return f"كل {names}"
    return None


async def handle_free_text(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    """أي نص ليس أمراً: إما جملة ينتظرها البوت، وإلا فمهمة جديدة."""
    if await consume_pending_time(message, session, user, today):
        return
    if await consume_pending_vocab(message, session, user, today):
        return
    if await consume_pending_note(message, session, user, today):
        return

    parsed = parse_task(message.text or "")
    if parsed is None:
        await message.answer("لم أفهم المهمة. جرّب مثلاً: <code>قراءة 20 صفحة</code>")
        return

    task, _ = await task_service.add_task(
        session,
        user,
        parsed.title,
        day=today,
        scheduled_time=parsed.scheduled_time,
        recurrence=parsed.recurrence,
        custom_days=parsed.custom_days,
    )

    await message.answer(
        render_task_added(
            task.title,
            parsed.scheduled_time,
            _recurrence_note(parsed.recurrence, parsed.custom_days),
        )
    )
    await show_today(message, session, user, today)


def build_router() -> Router:
    router = Router(name="today")

    router.message.register(handle_today_command, Command("today"))
    router.callback_query.register(handle_toggle, TaskCB.filter(F.action == "toggle"))
    router.callback_query.register(handle_refresh, DayCB.filter(F.action == "refresh"))
    router.callback_query.register(
        handle_add_task_prompt, DayCB.filter(F.action == "add_task")
    )
    router.callback_query.register(handle_note_prompt, DayCB.filter(F.action == "note"))
    # آخر ما يُسجَّل: أي نص عادي غير مطابق لأمر يُعامَل كمهمة جديدة
    router.message.register(handle_free_text, F.text & ~F.text.startswith("/"))

    return router
