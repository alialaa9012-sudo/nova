"""تغيير مواعيد الرسائل — يدوياً في أي وقت، أو عبر سؤال أسبوعي تلقائي."""

from __future__ import annotations

from datetime import date, time

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.bot.keyboards import ScheduleCB
from tracker.config import get_settings
from tracker.db.models import Schedule, User
from tracker.services import scheduling
from tracker.services.bootstrap import current_schedule
from tracker.services.parsing import parse_time_of_day
from tracker.services.render import render_schedule
from tracker.services.timeutil import format_time

PENDING_PREFIX = "time:"

SLOT_LABELS = {
    "morning": ("☀️", "رسالة اليوم"),
    "midday": ("⏰", "تذكير بالناقص"),
    "review": ("🌙", "المراجعة الليلية"),
}


def schedule_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for slot, (emoji, label) in SLOT_LABELS.items():
        builder.row(
            InlineKeyboardButton(
                text=f"{emoji} غيّر {label}",
                callback_data=ScheduleCB(action="edit", slot=slot).pack(),
            )
        )
    builder.row(
        InlineKeyboardButton(
            text="🚫 أوقف تذكير الناقص",
            callback_data=ScheduleCB(action="off", slot="midday").pack(),
        )
    )
    return builder.as_markup()


def weekly_ask_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(
            text="✅ زي ما هي",
            callback_data=ScheduleCB(action="keep", slot="all").pack(),
        ),
        InlineKeyboardButton(
            text="✏️ غيّرها",
            callback_data=ScheduleCB(action="open", slot="all").pack(),
        ),
    )
    return builder.as_markup()


async def _apply(
    session: AsyncSession, user: User, day: date, **changes: time | None
) -> Schedule:
    """يكتب صف مواعيد جديداً ساري من اليوم ويعيد جدولة ما لم يُرسَل بعد."""
    current = await current_schedule(session, user.id, day)
    values = {
        "morning_time": current.morning_time if current else time(11, 0),
        "midday_time": current.midday_time if current else time(15, 0),
        "review_time": current.review_time if current else time(0, 0),
    }
    values.update(changes)

    if current is not None and current.effective_from == day:
        for key, value in values.items():
            setattr(current, key, value)
        fresh = current
    else:
        fresh = Schedule(user_id=user.id, effective_from=day, **values)
        session.add(fresh)

    await session.flush()
    await scheduling.reschedule_from(session, user, day, get_settings().tz)
    return fresh


async def show_schedule(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    current = await current_schedule(session, user.id, today)
    if current is None:
        current = await _apply(session, user, today)

    await message.answer(
        render_schedule(current.morning_time, current.midday_time, current.review_time)
        + "\n\n<i>التغيير يسري من اليوم.</i>",
        reply_markup=schedule_keyboard(),
    )


async def handle_times_command(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    await show_schedule(message, session, user, today)


async def handle_edit_slot(
    query: CallbackQuery, callback_data: ScheduleCB, session: AsyncSession, user: User
) -> None:
    emoji, label = SLOT_LABELS[callback_data.slot]
    user.pending_action = PENDING_PREFIX + callback_data.slot
    user.pending_ref = None
    await session.flush()

    await query.answer()
    await query.message.answer(
        f"{emoji} اكتب الوقت الجديد لـ<b>{label}</b>:\n"
        "<i>أمثلة: 9 ص · 14:30 · 11 م</i>\n\n"
        "للإلغاء اكتب /cancel"
    )


async def handle_turn_off_midday(
    query: CallbackQuery, session: AsyncSession, user: User, today: date
) -> None:
    await _apply(session, user, today, midday_time=None)
    await query.answer("توقّف تذكير الناقص.")
    await query.message.answer(
        "🚫 أوقفت تذكير الناقص. تقدر ترجّعه في أي وقت من /times."
    )


async def handle_weekly_keep(
    query: CallbackQuery, session: AsyncSession, user: User
) -> None:
    await query.answer("تمام، سايبها زي ما هي.")
    await query.message.answer("👍 مواعيد الأسبوع الجاي زي ما هي.")


async def handle_weekly_open(
    query: CallbackQuery, session: AsyncSession, user: User, today: date
) -> None:
    await query.answer()
    await show_schedule(query.message, session, user, today)


async def consume_pending_time(
    message: Message, session: AsyncSession, user: User, today: date
) -> bool:
    """يستهلك الرسالة إن كان البوت ينتظر وقتاً. يعيد True عندها."""
    action = user.pending_action or ""
    if not action.startswith(PENDING_PREFIX):
        return False

    slot = action[len(PENDING_PREFIX) :]
    if slot not in SLOT_LABELS:
        user.pending_action = None
        await session.flush()
        return False

    parsed = parse_time_of_day(message.text or "")
    if parsed is None:
        await message.answer(
            "ما فهمتش الوقت. جرّب: <code>9 ص</code> أو <code>14:30</code>\n"
            "أو /cancel للإلغاء."
        )
        return True  # نظل منتظرين محاولة أخرى

    user.pending_action = None
    user.pending_ref = None
    await session.flush()

    updated = await _apply(session, user, today, **{f"{slot}_time": parsed})
    _, label = SLOT_LABELS[slot]

    await message.answer(
        f"✅ <b>{label}</b> بقى الساعة <b>{format_time(parsed)}</b>.\n\n"
        + render_schedule(
            updated.morning_time, updated.midday_time, updated.review_time
        )
    )
    return True


def build_router() -> Router:
    router = Router(name="schedule")

    router.message.register(handle_times_command, Command("times"))
    # تليجرام لا يقبل أوامر بحروف عربية، فنقبل الكلمة كنص عادي
    router.message.register(
        handle_times_command, F.text.strip().in_({"مواعيد", "/مواعيد", "المواعيد"})
    )
    router.callback_query.register(handle_edit_slot, ScheduleCB.filter(F.action == "edit"))
    router.callback_query.register(
        handle_turn_off_midday, ScheduleCB.filter(F.action == "off")
    )
    router.callback_query.register(handle_weekly_keep, ScheduleCB.filter(F.action == "keep"))
    router.callback_query.register(handle_weekly_open, ScheduleCB.filter(F.action == "open"))
    return router
