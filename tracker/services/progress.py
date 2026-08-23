"""تجميع التقدّم على مدى فترة — الرقمان يظلّان منفصلين هنا أيضاً.

لا تُشتقّ نسبة واحدة مدموجة في أي مكان: نسبة المهام ونسبة العادات
تُحسبان وتُعرضان مستقلتين، كما طُلب في مرحلة الاكتشاف.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import Habit, HabitLog, TaskInstance, User
from tracker.services.habits import active_on, streak


@dataclass
class HabitStat:
    habit: Habit
    done_days: int
    active_days: int
    stretch_days: int
    best_streak: int

    @property
    def pct(self) -> float:
        return (self.done_days / self.active_days * 100) if self.active_days else 0.0


@dataclass
class PeriodProgress:
    start: date
    end: date
    tasks_done: int = 0
    tasks_total: int = 0
    habits_done: int = 0
    habits_total: int = 0
    habit_stats: list[HabitStat] = field(default_factory=list)
    vocab_count: int = 0

    @property
    def tasks_pct(self) -> float:
        return (self.tasks_done / self.tasks_total * 100) if self.tasks_total else 0.0

    @property
    def habits_pct(self) -> float:
        return (self.habits_done / self.habits_total * 100) if self.habits_total else 0.0

    @property
    def is_empty(self) -> bool:
        return self.tasks_total == 0 and self.habits_total == 0


def days_between(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


async def summarize(
    session: AsyncSession, user: User, start: date, end: date
) -> PeriodProgress:
    """تقدّم فترة كاملة: المهام، العادات، وإحصاءة لكل عادة."""
    progress = PeriodProgress(start=start, end=end)

    instances = (
        await session.scalars(
            select(TaskInstance).where(
                TaskInstance.user_id == user.id,
                TaskInstance.occurrence_date >= start,
                TaskInstance.occurrence_date <= end,
            )
        )
    ).all()
    progress.tasks_total = len(instances)
    progress.tasks_done = sum(1 for i in instances if i.is_done)

    habits = (
        await session.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.is_active.is_(True))
            .order_by(Habit.sort_order, Habit.id)
        )
    ).all()

    span = days_between(start, end)
    for habit in habits:
        active = [d for d in span if active_on(habit, d)]
        if not active:
            continue

        logs = {
            log.log_date: log
            for log in (
                await session.scalars(
                    select(HabitLog).where(
                        HabitLog.habit_id == habit.id,
                        HabitLog.log_date >= start,
                        HabitLog.log_date <= end,
                    )
                )
            ).all()
        }
        done_days = sum(1 for d in active if d in logs and logs[d].is_done)
        stretch_days = sum(1 for d in active if d in logs and logs[d].is_stretch)

        progress.habits_done += done_days
        progress.habits_total += len(active)
        progress.habit_stats.append(
            HabitStat(
                habit=habit,
                done_days=done_days,
                active_days=len(active),
                stretch_days=stretch_days,
                best_streak=await streak(session, habit, end),
            )
        )

    progress.habit_stats.sort(key=lambda s: s.pct, reverse=True)
    return progress


async def compare(
    session: AsyncSession, user: User, start: date, end: date
) -> tuple[PeriodProgress, PeriodProgress]:
    """الفترة الحالية والفترة السابقة بنفس الطول، للمقارنة."""
    length = (end - start).days + 1
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=length - 1)
    return (
        await summarize(session, user, start, end),
        await summarize(session, user, previous_start, previous_end),
    )


def delta_note(current: float, previous: float) -> str | None:
    """جملة مقارنة قصيرة، أو None إذا لم يكن هناك ما يُقارَن به."""
    if previous == 0.0 and current == 0.0:
        return None
    diff = current - previous
    if abs(diff) < 1.0:
        return "زي الفترة اللي فاتت"
    if diff > 0:
        return f"أحسن بـ {diff:.0f}% عن الفترة اللي فاتت"
    return f"أقل بـ {abs(diff):.0f}% عن الفترة اللي فاتت"
