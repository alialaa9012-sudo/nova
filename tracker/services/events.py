"""الأحداث القادمة وتذكيراتها."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import Event, Reminder, ReminderKind, User

DEFAULT_LEAD_MINUTES = 30
UPCOMING_WINDOW_DAYS = 7


async def add(
    session: AsyncSession,
    user: User,
    title: str,
    *,
    event_date: date,
    event_time: time | None = None,
    reminder_minutes_before: int = DEFAULT_LEAD_MINUTES,
    tz: ZoneInfo,
) -> Event:
    """ينشئ حدثاً، ويجدول تذكيره إن كان له وقت ولم يمضِ بعد."""
    event = Event(
        user_id=user.id,
        title=title.strip(),
        event_date=event_date,
        event_time=event_time,
        reminder_minutes_before=reminder_minutes_before,
    )
    session.add(event)
    await session.flush()

    await schedule_reminder(session, user, event, tz=tz)
    return event


async def schedule_reminder(
    session: AsyncSession, user: User, event: Event, *, tz: ZoneInfo
) -> Reminder | None:
    """يجدول تذكير الحدث. حدث بلا وقت أو مضى موعده لا يُذكَّر به."""
    if event.event_time is None or user.is_paused:
        return None

    moment = datetime.combine(event.event_date, event.event_time, tzinfo=tz)
    due_at = moment - timedelta(minutes=event.reminder_minutes_before)
    if due_at <= datetime.now(tz):
        return None

    reminder = Reminder(
        user_id=user.id,
        kind=ReminderKind.EVENT,
        for_day=event.event_date,
        due_at=due_at,
        payload={"event_id": event.id},
    )
    session.add(reminder)
    await session.flush()
    return reminder


async def upcoming(
    session: AsyncSession,
    user: User,
    today: date,
    *,
    days: int = UPCOMING_WINDOW_DAYS,
    limit: int = 5,
) -> list[Event]:
    """أحداث اليوم والأيام القليلة القادمة، الأقرب أولاً."""
    return list(
        (
            await session.scalars(
                select(Event)
                .where(
                    Event.user_id == user.id,
                    Event.event_date >= today,
                    Event.event_date <= today + timedelta(days=days),
                )
                .order_by(Event.event_date, Event.event_time.nulls_last(), Event.id)
                .limit(limit)
            )
        ).all()
    )


async def remove_reminders(session: AsyncSession, user: User, event_id: int) -> None:
    """يحذف تذكيرات حدثٍ لم تُرسَل — يُستدعى قبل إعادة الجدولة أو عند الحذف."""
    rows = (
        await session.scalars(
            select(Reminder).where(
                Reminder.user_id == user.id,
                Reminder.kind == ReminderKind.EVENT,
                Reminder.is_sent.is_(False),
            )
        )
    ).all()
    for row in rows:
        if (row.payload or {}).get("event_id") == event_id:
            await session.delete(row)
    await session.flush()


async def remove(session: AsyncSession, user: User, event_id: int) -> bool:
    event = await session.get(Event, event_id)
    if event is None or event.user_id != user.id:
        return False

    await remove_reminders(session, user, event_id)
    await session.delete(event)
    await session.flush()
    return True
