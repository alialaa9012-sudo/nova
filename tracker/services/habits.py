"""منطق العادات: التسجيل، حدّ الإنجاز، حدّ التميّز، والسلاسل.

عادة القراءة تُظهر لماذا يوجد حدّان: صفحتان تكفيان لاعتبار اليوم منجزاً
(فلا تنكسر السلسلة في يوم مزدحم)، وخمس صفحات تستحق علامة تميّز.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import Habit, HabitKind, HabitLog, User, VocabEntry

MAX_STREAK_LOOKBACK = 400


def active_on(habit: Habit, day: date) -> bool:
    if not habit.is_active:
        return False
    if habit.active_days is None:
        return True
    return day.weekday() in habit.active_days


async def habits_for_day(session: AsyncSession, user: User, day: date) -> list[Habit]:
    habits = (
        await session.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.is_active.is_(True))
            .order_by(Habit.sort_order, Habit.id)
        )
    ).all()
    return [h for h in habits if active_on(h, day)]


async def get_or_create_log(
    session: AsyncSession, habit: Habit, day: date
) -> HabitLog:
    log = await session.scalar(
        select(HabitLog).where(HabitLog.habit_id == habit.id, HabitLog.log_date == day)
    )
    if log is None:
        log = HabitLog(habit_id=habit.id, user_id=habit.user_id, log_date=day, value=0.0)
        session.add(log)
        await session.flush()
    return log


def _apply_thresholds(habit: Habit, log: HabitLog) -> None:
    log.is_done = log.value >= habit.target_value
    log.is_stretch = (
        habit.stretch_value is not None and log.value >= habit.stretch_value
    )


async def record(
    session: AsyncSession,
    user: User,
    habit_id: int,
    *,
    day: date,
    delta: float | None = None,
    absolute: float | None = None,
) -> HabitLog | None:
    """يسجّل قيمة عادة: زيادة نسبية أو قيمة مطلقة.

    العادة من نوع نعم/لا تُقلب حالتها إذا لم تُمرَّر قيمة.
    يعيد None إذا كانت العادة ليست لهذا المستخدم.
    """
    habit = await session.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id:
        return None

    log = await get_or_create_log(session, habit, day)

    if habit.kind is HabitKind.BOOLEAN and delta is None and absolute is None:
        log.value = 0.0 if log.is_done else habit.target_value
    elif absolute is not None:
        log.value = max(0.0, absolute)
    elif delta is not None:
        log.value = max(0.0, log.value + delta)

    _apply_thresholds(habit, log)
    await session.flush()
    return log


async def add_vocab_entry(
    session: AsyncSession, user: User, habit_id: int, content: str, *, day: date
) -> tuple[VocabEntry, HabitLog] | None:
    """يحفظ جملة في القاموس ويزيد عدّاد العادة خطوة واحدة."""
    habit = await session.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id:
        return None

    text = content.strip()
    if not text:
        return None

    log = await record(session, user, habit_id, day=day, delta=1.0)
    entry = VocabEntry(
        user_id=user.id,
        habit_log_id=log.id if log else None,
        content=text,
        entry_date=day,
    )
    session.add(entry)
    await session.flush()
    return entry, log


async def logs_for_day(
    session: AsyncSession, user: User, day: date
) -> dict[int, HabitLog]:
    logs = (
        await session.scalars(
            select(HabitLog).where(HabitLog.user_id == user.id, HabitLog.log_date == day)
        )
    ).all()
    return {log.habit_id: log for log in logs}


async def day_state(
    session: AsyncSession, user: User, day: date
) -> list[tuple[Habit, HabitLog | None]]:
    """عادات اليوم مع سجلّ كلٍّ منها (None إذا لم تُسجَّل بعد)."""
    habits = await habits_for_day(session, user, day)
    logs = await logs_for_day(session, user, day)
    return [(h, logs.get(h.id)) for h in habits]


def completion(state: list[tuple[Habit, HabitLog | None]]) -> tuple[int, int, float]:
    """(المنجز، الإجمالي، النسبة). يوم بلا عادات نشطة = 0%."""
    total = len(state)
    done = sum(1 for _, log in state if log is not None and log.is_done)
    pct = (done / total * 100) if total else 0.0
    return done, total, pct


async def streak(session: AsyncSession, habit: Habit, up_to: date) -> int:
    """عدد الأيام المتتالية المنجزة المنتهية عند ``up_to``.

    الأيام التي لا تنشط فيها العادة تُتخطّى ولا تكسر السلسلة.
    """
    done_days = set(
        (
            await session.scalars(
                select(HabitLog.log_date).where(
                    HabitLog.habit_id == habit.id,
                    HabitLog.is_done.is_(True),
                    HabitLog.log_date <= up_to,
                )
            )
        ).all()
    )
    if not done_days:
        return 0

    count = 0
    cursor = up_to
    for _ in range(MAX_STREAK_LOOKBACK):
        if not active_on(habit, cursor):
            cursor -= timedelta(days=1)
            continue
        if cursor not in done_days:
            break
        count += 1
        cursor -= timedelta(days=1)
    return count


async def vocab_entries(
    session: AsyncSession,
    user: User,
    *,
    since: date | None = None,
    until: date | None = None,
    limit: int | None = None,
) -> list[VocabEntry]:
    query = select(VocabEntry).where(VocabEntry.user_id == user.id)
    if since is not None:
        query = query.where(VocabEntry.entry_date >= since)
    if until is not None:
        query = query.where(VocabEntry.entry_date <= until)
    query = query.order_by(VocabEntry.entry_date.desc(), VocabEntry.id.desc())
    if limit is not None:
        query = query.limit(limit)
    return list((await session.scalars(query)).all())
