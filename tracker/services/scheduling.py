"""بناء طابور التذكيرات من جدول المواعيد.

الطابور صفوفٌ في القاعدة لا مؤقّتات في الذاكرة، فينجو من إعادة النشر ومن
نوم الخدمة على الطبقة المجانية. نبضة ``/cron/tick`` تسحب المستحق منه.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import Reminder, ReminderKind, Schedule, User
from tracker.services.bootstrap import current_schedule
from tracker.services.timeutil import at_time_on, is_last_day_of_month, is_week_end

# التذكيرات اليومية التي يولّدها جدول المواعيد
DAILY_KINDS = (ReminderKind.MORNING, ReminderKind.MIDDAY, ReminderKind.REVIEW)

# كم يوماً نجهّز مقدماً — يكفي ليغطّي نوم الخدمة وأي تأخير في النبضة
LOOKAHEAD_DAYS = 2


def _slot_time(schedule: Schedule, kind: ReminderKind) -> time | None:
    if kind is ReminderKind.MORNING:
        return schedule.morning_time
    if kind is ReminderKind.MIDDAY:
        return schedule.midday_time
    if kind is ReminderKind.REVIEW:
        return schedule.review_time
    return None


async def ensure_day(
    session: AsyncSession, user: User, day: date, tz: ZoneInfo
) -> list[Reminder]:
    """يضمن وجود تذكيرات هذا اليوم بلا تكرار. مستخدم موقوف = لا تذكيرات."""
    if user.is_paused:
        return []

    schedule = await current_schedule(session, user.id, day)
    if schedule is None:
        return []

    existing = {
        r.kind
        for r in (
            await session.scalars(
                select(Reminder).where(
                    Reminder.user_id == user.id,
                    Reminder.for_day == day,
                    Reminder.kind.in_(DAILY_KINDS),
                )
            )
        ).all()
    }

    created: list[Reminder] = []
    for kind in DAILY_KINDS:
        if kind in existing:
            continue
        at = _slot_time(schedule, kind)
        if at is None:  # تذكير منتصف اليوم اختياري
            continue

        reminder = Reminder(
            user_id=user.id,
            kind=kind,
            for_day=day,
            due_at=at_time_on(day, at, tz, user.day_boundary_hour),
        )
        session.add(reminder)
        created.append(reminder)

    # سؤال مواعيد الأسبوع الجاي يركب مع مراجعة ليلة نهاية الأسبوع
    if is_week_end(day, user.week_start):
        await _ensure_extra(session, user, day, tz, ReminderKind.SCHEDULE_ASK, schedule.review_time, created)
        await _ensure_extra(session, user, day, tz, ReminderKind.WEEKLY_REPORT, schedule.review_time, created)
    if is_last_day_of_month(day):
        await _ensure_extra(session, user, day, tz, ReminderKind.MONTHLY_REPORT, schedule.review_time, created)

    await session.flush()
    return created


async def _ensure_extra(
    session: AsyncSession,
    user: User,
    day: date,
    tz: ZoneInfo,
    kind: ReminderKind,
    at: time,
    created: list[Reminder],
) -> None:
    already = await session.scalar(
        select(Reminder).where(
            Reminder.user_id == user.id,
            Reminder.for_day == day,
            Reminder.kind == kind,
        )
    )
    if already is not None:
        return
    reminder = Reminder(
        user_id=user.id,
        kind=kind,
        for_day=day,
        due_at=at_time_on(day, at, tz, user.day_boundary_hour),
    )
    session.add(reminder)
    created.append(reminder)


async def ensure_horizon(
    session: AsyncSession, user: User, today: date, tz: ZoneInfo
) -> list[Reminder]:
    """يجهّز تذكيرات اليوم والأيام القليلة القادمة."""
    created: list[Reminder] = []
    for offset in range(LOOKAHEAD_DAYS + 1):
        created += await ensure_day(session, user, today + timedelta(days=offset), tz)
    return created


async def reschedule_from(
    session: AsyncSession, user: User, day: date, tz: ZoneInfo
) -> list[Reminder]:
    """يحذف التذكيرات غير المُرسَلة من هذا اليوم فصاعداً ويعيد بناءها.

    يُستدعى بعد تغيير المواعيد: ما أُرسل يبقى، وما لم يُرسل ينتقل للوقت الجديد.
    """
    await session.execute(
        delete(Reminder).where(
            Reminder.user_id == user.id,
            Reminder.is_sent.is_(False),
            Reminder.for_day >= day,
        )
    )
    await session.flush()
    return await ensure_horizon(session, user, day, tz)


async def due_now(
    session: AsyncSession, now: datetime, limit: int = 20
) -> list[Reminder]:
    """التذكيرات المستحقة التي لم تُرسل بعد، الأقدم أولاً."""
    return list(
        (
            await session.scalars(
                select(Reminder)
                .where(Reminder.is_sent.is_(False), Reminder.due_at <= now)
                .order_by(Reminder.due_at)
                .limit(limit)
            )
        ).all()
    )


def mark_sent(reminder: Reminder, now: datetime) -> None:
    reminder.is_sent = True
    reminder.sent_at = now


async def cancel_day(session: AsyncSession, user: User, day: date) -> None:
    """يلغي كل ما لم يُرسل من يومٍ معيّن فصاعداً (وضع الإجازة)."""
    await session.execute(
        delete(Reminder).where(
            Reminder.user_id == user.id,
            Reminder.is_sent.is_(False),
            Reminder.for_day >= day,
        )
    )
    await session.flush()
