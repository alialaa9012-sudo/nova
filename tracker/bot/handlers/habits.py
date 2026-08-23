"""تسجيل العادات وقاموس الجمل الإنجليزية."""

from __future__ import annotations

from datetime import date, timedelta

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.bot.keyboards import HabitCB
from tracker.db.models import Habit, HabitKind, User
from tracker.services import habits as habit_service
from tracker.services.render import format_value
from tracker.services.timeutil import format_arabic_date, week_bounds

PENDING_VOCAB = "vocab"
DICT_PAGE_SIZE = 30


async def handle_habit_tap(
    query: CallbackQuery,
    callback_data: HabitCB,
    session: AsyncSession,
    user: User,
    today: date,
) -> None:
    """ضغطة على عادة: تبديل لنعم/لا، أو زيادة للعدّاد."""
    habit = await session.get(Habit, callback_data.habit_id)
    if habit is None or habit.user_id != user.id:
        await query.answer("لم أجد هذه العادة.", show_alert=True)
        return

    if callback_data.action == "toggle":
        log = await habit_service.record(session, user, habit.id, day=today)
        await query.answer("تم ✅" if log.is_done else "رجعت ⬜")
    else:
        step = callback_data.step
        if step == 0.0:
            # الضغط على زر الحالة نفسه لا يغيّر شيئاً — يعرض التفاصيل فقط
            await query.answer(await _habit_summary(session, habit, today), show_alert=True)
            return
        log = await habit_service.record(session, user, habit.id, day=today, delta=step)
        await query.answer(_increment_toast(habit, log.value, log.is_stretch, log.is_done))

    from tracker.bot.handlers.today import refresh_today

    await refresh_today(query, session, user, today)


def _increment_toast(habit: Habit, value: float, is_stretch: bool, is_done: bool) -> str:
    unit = f" {habit.unit}" if habit.unit else ""
    body = f"{format_value(value)}/{format_value(habit.target_value)}{unit}"
    if is_stretch:
        return f"⭐ ممتاز — {body}"
    if is_done:
        return f"✅ تمام — {body}"
    return body


async def _habit_summary(session: AsyncSession, habit: Habit, today: date) -> str:
    streak = await habit_service.streak(session, habit, today)
    lines = [f"{habit.emoji} {habit.name}"]
    unit = f" {habit.unit}" if habit.unit else ""
    lines.append(f"الهدف: {format_value(habit.target_value)}{unit}")
    if habit.stretch_value is not None:
        lines.append(f"ممتاز عند: {format_value(habit.stretch_value)}{unit}")
    lines.append(f"🔥 سلسلة: {streak} يوم" if streak else "لا توجد سلسلة بعد")
    return "\n".join(lines)


async def handle_vocab_prompt(
    query: CallbackQuery,
    callback_data: HabitCB,
    session: AsyncSession,
    user: User,
) -> None:
    """يطلب كتابة الجملة ويسجّل الانتظار في القاعدة لا في الذاكرة."""
    habit = await session.get(Habit, callback_data.habit_id)
    if habit is None or habit.user_id != user.id:
        await query.answer("لم أجد هذه العادة.", show_alert=True)
        return

    user.pending_action = PENDING_VOCAB
    user.pending_ref = habit.id
    await session.flush()

    await query.answer()
    await query.message.answer(
        "✍️ اكتب الجملة الإنجليزية الجديدة:\n"
        "<i>ستُحفظ في قاموسك، وتراجعها معك آخر الأسبوع.</i>\n\n"
        "للإلغاء اكتب /cancel"
    )


async def consume_pending_vocab(
    message: Message, session: AsyncSession, user: User, today: date
) -> bool:
    """يحفظ الجملة إن كان البوت ينتظرها. يعيد True إذا استهلك الرسالة."""
    if user.pending_action != PENDING_VOCAB or user.pending_ref is None:
        return False

    habit_id = user.pending_ref
    user.pending_action = None
    user.pending_ref = None
    await session.flush()

    result = await habit_service.add_vocab_entry(
        session, user, habit_id, message.text or "", day=today
    )
    if result is None:
        await message.answer("الجملة فاضية — لم أحفظ شيئاً.")
        return True

    entry, log = result
    habit = await session.get(Habit, habit_id)
    remaining = max(0.0, habit.target_value - log.value)
    tail = (
        "✅ كمّلت جمل النهارده."
        if log.is_done
        else f"باقي {format_value(remaining)} جملة."
    )
    await message.answer(f"💾 اتحفظت: <b>{entry.content}</b>\n{tail}")

    from tracker.bot.handlers.today import show_today

    await show_today(message, session, user, today)
    return True


async def handle_cancel(
    message: Message, session: AsyncSession, user: User
) -> None:
    if user.pending_action is None:
        await message.answer("لا يوجد شيء لإلغائه.")
        return
    user.pending_action = None
    user.pending_ref = None
    await session.flush()
    await message.answer("تم الإلغاء.")


async def handle_dict(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    """قاموسك: آخر الجمل المحفوظة، مجمّعة حسب اليوم."""
    entries = await habit_service.vocab_entries(session, user, limit=DICT_PAGE_SIZE)
    if not entries:
        await message.answer(
            "📖 قاموسك فاضي لسه.\n"
            "اضغط ✍️ جنب عادة الجمل الإنجليزية في رسالة اليوم وابدأ."
        )
        return

    week_start, _ = week_bounds(today, user.week_start)
    this_week = sum(1 for e in entries if e.entry_date >= week_start)

    lines = [f"📖 <b>قاموسك</b> — آخر {len(entries)} جملة"]
    if this_week:
        lines.append(f"<i>{this_week} منها هذا الأسبوع</i>")

    current_day: date | None = None
    for entry in entries:
        if entry.entry_date != current_day:
            current_day = entry.entry_date
            lines.append(f"\n<b>{format_arabic_date(current_day)}</b>")
        lines.append(f"• {entry.content}")

    await message.answer("\n".join(lines))


def build_router() -> Router:
    router = Router(name="habits")

    router.message.register(handle_dict, Command("dict"))
    router.message.register(handle_cancel, Command("cancel"))
    router.callback_query.register(
        handle_vocab_prompt, HabitCB.filter(F.action == "vocab")
    )
    router.callback_query.register(
        handle_habit_tap, HabitCB.filter(F.action.in_({"inc", "toggle"}))
    )
    return router
