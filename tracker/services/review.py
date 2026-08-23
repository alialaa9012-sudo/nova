"""المراجعة الليلية: ماذا تمّ، ماذا فات، وما الذي يُرحَّل لبكرة."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import DailyReview, Habit, HabitLog, User
from tracker.services import habits as habit_service
from tracker.services import notes as note_service
from tracker.services import tasks as task_service

MOODS: dict[int, str] = {1: "😞", 2: "😐", 3: "🙂", 4: "😄"}


@dataclass
class DaySummary:
    day: date
    done_titles: list[str] = field(default_factory=list)
    missed_titles: list[str] = field(default_factory=list)
    tasks_pct: float = 0.0
    habits_pct: float = 0.0
    habit_done: int = 0
    habit_total: int = 0
    habit_state: list[tuple[Habit, HabitLog | None]] = field(default_factory=list)
    streaks: list[tuple[Habit, int]] = field(default_factory=list)
    note: str | None = None
    carryable: int = 0

    @property
    def task_done(self) -> int:
        return len(self.done_titles)

    @property
    def task_total(self) -> int:
        return len(self.done_titles) + len(self.missed_titles)


async def summarize(session: AsyncSession, user: User, day: date) -> DaySummary:
    """كل ما تحتاجه رسالة المراجعة، مجموعاً في نداء واحد."""
    pairs = await task_service.day_pairs(session, user, day)
    _, _, tasks_pct = task_service.completion(pairs)

    summary = DaySummary(day=day, tasks_pct=tasks_pct)
    for task, instance in pairs:
        (summary.done_titles if instance.is_done else summary.missed_titles).append(
            task.title
        )
        if not instance.is_done and task_service.is_carryable(task):
            summary.carryable += 1

    summary.habit_state = await habit_service.day_state(session, user, day)
    (
        summary.habit_done,
        summary.habit_total,
        summary.habits_pct,
    ) = habit_service.completion(summary.habit_state)

    for habit, log in summary.habit_state:
        if log is not None and log.is_done:
            streak = await habit_service.streak(session, habit, day)
            if streak >= 2:
                summary.streaks.append((habit, streak))

    summary.note = await note_service.text_for(session, user, day)
    return summary


async def save(
    session: AsyncSession,
    user: User,
    summary: DaySummary,
    *,
    mood: int | None = None,
    carried_ids: list[int] | None = None,
) -> DailyReview:
    """يكتب أو يحدّث مراجعة اليوم. الرقمان يُحفظان منفصلين كما يُعرضان."""
    review = await session.scalar(
        select(DailyReview).where(
            DailyReview.user_id == user.id, DailyReview.review_date == summary.day
        )
    )
    if review is None:
        review = DailyReview(user_id=user.id, review_date=summary.day)
        session.add(review)

    review.tasks_pct = summary.tasks_pct
    review.habits_pct = summary.habits_pct
    review.completed_count = summary.task_done
    review.missed_count = len(summary.missed_titles)
    review.notes = summary.note
    if mood is not None:
        review.mood = mood
    if carried_ids is not None:
        review.carried_task_ids = carried_ids

    await session.flush()
    return review


async def carry_to_tomorrow(
    session: AsyncSession, user: User, day: date
) -> list[int]:
    """يرحّل مهام اليوم غير المنجزة القابلة للترحيل، ويعيد معرّفاتها."""
    moved = await task_service.carry_unfinished(
        session, user, from_day=day, to_day=day + timedelta(days=1)
    )
    return [instance.task_id for instance in moved]
