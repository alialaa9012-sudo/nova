"""إضافة الأحداث القادمة وعرضها."""

from __future__ import annotations

from datetime import date

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.bot.keyboards import EventCB
from tracker.config import get_settings
from tracker.db.models import User
from tracker.services import events as event_service
from tracker.services.parsing import parse_event
from tracker.services.render import render_event_added, render_events
from tracker.services.timeutil import format_arabic_date

PENDING_EVENT = "event"

EVENT_HINT = (
    "📅 اكتب الحدث بالوقت والتاريخ:\n\n"
    "• <code>اجتماع مع الفريق بكرة 10 ص</code>\n"
    "• <code>تسليم المشروع الخميس 3 م</code>\n"
    "• <code>دكتور 25/9 6 م</code>\n\n"
    "للإلغاء اكتب /cancel"
)


def lead_keyboard(event_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(
        *[
            InlineKeyboardButton(
                text=f"{minutes} دقيقة",
                callback_data=EventCB(
                    action="lead", event_id=event_id, value=minutes
                ).pack(),
            )
            for minutes in (15, 30, 60)
        ]
    )
    builder.row(
        InlineKeyboardButton(
            text="🗑 احذف الحدث",
            callback_data=EventCB(action="delete", event_id=event_id, value=0).pack(),
        )
    )
    return builder.as_markup()


async def handle_event_command(
    message: Message, session: AsyncSession, user: User
) -> None:
    user.pending_action = PENDING_EVENT
    user.pending_ref = None
    await session.flush()
    await message.answer(EVENT_HINT)


async def handle_event_prompt(
    query: CallbackQuery, session: AsyncSession, user: User
) -> None:
    await query.answer()
    await handle_event_command(query.message, session, user)


async def consume_pending_event(
    message: Message, session: AsyncSession, user: User, today: date
) -> bool:
    if user.pending_action != PENDING_EVENT:
        return False

    parsed = parse_event(message.text or "", today)
    if parsed is None:
        await message.answer("ما فهمتش الحدث. جرّب: <code>اجتماع بكرة 10 ص</code>")
        return True  # نظل منتظرين

    user.pending_action = None
    user.pending_ref = None
    await session.flush()

    event = await event_service.add(
        session,
        user,
        parsed.title,
        event_date=parsed.event_date,
        event_time=parsed.event_time,
        tz=get_settings().tz,
    )

    await message.answer(
        render_event_added(
            event.title, event.event_date, event.event_time, event.reminder_minutes_before
        ),
        reply_markup=lead_keyboard(event.id) if event.event_time else None,
    )

    from tracker.bot.handlers.today import show_today

    await show_today(message, session, user, today)
    return True


async def handle_change_lead(
    query: CallbackQuery, callback_data: EventCB, session: AsyncSession, user: User
) -> None:
    from tracker.db.models import Event

    event = await session.get(Event, callback_data.event_id)
    if event is None or event.user_id != user.id:
        await query.answer("لم أجد هذا الحدث.", show_alert=True)
        return

    event.reminder_minutes_before = callback_data.value
    await session.flush()

    # أعد جدولة التذكير على المهلة الجديدة
    await event_service.remove_reminders(session, user, event.id)
    await event_service.schedule_reminder(session, user, event, tz=get_settings().tz)

    await query.answer(f"التذكير قبلها بـ{callback_data.value} دقيقة.")


async def handle_delete_event(
    query: CallbackQuery, callback_data: EventCB, session: AsyncSession, user: User
) -> None:
    removed = await event_service.remove(session, user, callback_data.event_id)
    await query.answer("اتحذف." if removed else "لم أجد هذا الحدث.")
    if removed:
        await query.message.edit_reply_markup(reply_markup=None)


async def handle_events_list(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    upcoming = await event_service.upcoming(session, user, today, limit=10)
    if not upcoming:
        await message.answer(
            "📅 مفيش أحداث قادمة.\nاكتب /event عشان تضيف واحد."
        )
        return

    lines = ["📅 <b>الأحداث القادمة</b>", ""]
    lines += render_events(upcoming, today)
    await message.answer("\n".join(lines))


def build_router() -> Router:
    router = Router(name="events")
    router.message.register(handle_event_command, Command("event"))
    router.message.register(handle_events_list, Command("events"))
    router.callback_query.register(handle_change_lead, EventCB.filter(F.action == "lead"))
    router.callback_query.register(
        handle_delete_event, EventCB.filter(F.action == "delete")
    )
    return router
