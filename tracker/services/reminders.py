"""تنفيذ التذكيرات المستحقة — القلب النابض للنبضة الخارجية.

كل نداء يفعل شيئين: يرسل ما استحقّ، ثم يجهّز أفق الأيام القادمة. بهذا تبقى
النبضة الواحدة كافية بلا أي جدولة في الذاكرة.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import Reminder, ReminderKind, User
from tracker.services import habits as habit_service
from tracker.services import notes as note_service
from tracker.services import scheduling
from tracker.services import tasks as task_service
from tracker.services.render import render_midday, render_schedule, render_today
from tracker.services.timeutil import logical_date

logger = logging.getLogger(__name__)


@dataclass
class TickResult:
    sent: int = 0
    failed: int = 0
    scheduled: int = 0

    def as_dict(self) -> dict[str, int]:
        return {"sent": self.sent, "failed": self.failed, "scheduled": self.scheduled}


async def _today_payload(
    session: AsyncSession, user: User, day: date, now: datetime
) -> tuple[str, object]:
    from tracker.bot.keyboards import today_keyboard

    pairs = await task_service.day_pairs(session, user, day)
    task_done, task_total, tasks_pct = task_service.completion(pairs)
    carried = sum(1 for _, inst in pairs if inst.carried_from_date)

    habit_state = await habit_service.day_state(session, user, day)
    habit_done, habit_total, habits_pct = habit_service.completion(habit_state)

    text = render_today(
        name=user.first_name or "صديقي",
        now=now,
        day=day,
        task_done=task_done,
        task_total=task_total,
        tasks_pct=tasks_pct,
        habit_done=habit_done,
        habit_total=habit_total,
        habits_pct=habits_pct,
        carried_count=carried,
        note=await note_service.text_for(session, user, day),
    )
    return text, today_keyboard(pairs, habit_state)


async def _send_morning(
    bot: Bot, session: AsyncSession, user: User, day: date, now: datetime
) -> None:
    text, markup = await _today_payload(session, user, day, now)
    sent = await bot.send_message(user.telegram_id, text, reply_markup=markup)
    user.today_message_id = sent.message_id
    user.today_message_date = day


async def _send_midday(
    bot: Bot, session: AsyncSession, user: User, day: date, now: datetime
) -> bool:
    """تذكير بالناقص فقط. لا يُرسَل شيء إذا لم يبقَ ناقص — لا رسائل بلا سبب."""
    pairs = await task_service.day_pairs(session, user, day)
    pending_tasks = [t.title for t, inst in pairs if not inst.is_done]

    habit_state = await habit_service.day_state(session, user, day)
    pending_habits = [
        f"{h.emoji} {h.name}" for h, log in habit_state if not (log and log.is_done)
    ]

    if not pending_tasks and not pending_habits:
        return False

    await bot.send_message(
        user.telegram_id, render_midday(pending_tasks, pending_habits)
    )
    return True


async def _send_schedule_ask(
    bot: Bot, session: AsyncSession, user: User, day: date
) -> None:
    """سؤال نهاية الأسبوع عن مواعيد الأسبوع الجاي — أساس المرونة المطلوبة."""
    from tracker.bot.handlers.schedule import weekly_ask_keyboard
    from tracker.services.bootstrap import current_schedule

    schedule = await current_schedule(session, user.id, day)
    if schedule is None:
        return

    body = render_schedule(
        schedule.morning_time, schedule.midday_time, schedule.review_time
    )
    await bot.send_message(
        user.telegram_id,
        f"📅 <b>الأسبوع الجاي</b>\n\nمواعيدك الحالية:\n\n{body}",
        reply_markup=weekly_ask_keyboard(),
    )


async def _dispatch(
    bot: Bot, session: AsyncSession, user: User, reminder: Reminder, now: datetime
) -> bool:
    """يرسل تذكيراً واحداً. يعيد False إذا تقرّر تخطّيه بلا رسالة."""
    day = reminder.for_day or logical_date(now, user.day_boundary_hour)

    if reminder.kind is ReminderKind.MORNING:
        await _send_morning(bot, session, user, day, now)
        return True

    if reminder.kind is ReminderKind.MIDDAY:
        return await _send_midday(bot, session, user, day, now)

    if reminder.kind is ReminderKind.REVIEW:
        from tracker.bot.handlers.review import send_review

        await send_review(bot, session, user, day)
        return True

    if reminder.kind is ReminderKind.WEEKLY_REPORT:
        from tracker.bot.handlers.reports import build_weekly

        await bot.send_message(user.telegram_id, await build_weekly(session, user, day))
        return True

    if reminder.kind is ReminderKind.MONTHLY_REPORT:
        from tracker.bot.handlers.reports import build_monthly

        await bot.send_message(user.telegram_id, await build_monthly(session, user, day))
        return True

    if reminder.kind is ReminderKind.SCHEDULE_ASK:
        await _send_schedule_ask(bot, session, user, day)
        return True

    logger.info("نوع تذكير لم يُنفَّذ بعد: %s", reminder.kind)
    return False


async def run_tick(bot: Bot, session: AsyncSession, now: datetime) -> TickResult:
    """يرسل كل ما استحقّ ثم يجهّز الأفق. آمن للاستدعاء كل دقيقة."""
    result = TickResult()

    for reminder in await scheduling.due_now(session, now):
        user = await session.get(User, reminder.user_id)
        if user is None:
            scheduling.mark_sent(reminder, now)
            continue

        if user.is_paused:
            scheduling.mark_sent(reminder, now)
            continue

        try:
            if await _dispatch(bot, session, user, reminder, now):
                result.sent += 1
        except TelegramAPIError:
            # نعلّمه مُرسَلاً رغم الفشل حتى لا تعلق النبضة على تذكير واحد للأبد
            logger.exception("فشل إرسال تذكير %s", reminder.id)
            result.failed += 1

        scheduling.mark_sent(reminder, now)

    for user in (await session.scalars(select(User))).all():
        day = logical_date(now, user.day_boundary_hour)
        created = await scheduling.ensure_horizon(session, user, day, now.tzinfo)
        result.scheduled += len(created)

    await session.flush()
    return result
