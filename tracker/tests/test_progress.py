"""اختبارات تجميع التقدّم على فترة."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from tracker.db.models import Habit, Recurrence
from tracker.services import habits as habit_service
from tracker.services import progress as progress_service
from tracker.services import tasks as task_service
from tracker.services.bootstrap import get_or_create_user

WEEK_START = date(2026, 8, 22)   # سبت
WEEK_END = date(2026, 8, 28)     # جمعة
MONTH_START = date(2026, 8, 1)


async def _setup(session):
    user, _ = await get_or_create_user(
        session, 6493959847, first_name="Ali", today=date(2026, 7, 1)
    )
    habits = {
        h.name: h
        for h in (await session.scalars(select(Habit).where(Habit.user_id == user.id))).all()
    }
    return user, habits


class TestEmptyPeriod:
    async def test_no_data_reports_empty(self, session):
        user, _ = await _setup(session)
        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        assert result.tasks_total == 0
        assert result.tasks_pct == 0.0

    async def test_habits_count_even_with_no_logs(self, session):
        """العادات نشطة كل يوم، فالمقام موجود حتى لو لم يُسجَّل شيء."""
        user, _ = await _setup(session)
        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        assert result.habits_total == 4 * 7
        assert result.habits_done == 0
        assert result.is_empty is False


class TestTasks:
    async def test_counts_instances_in_range_only(self, session):
        user, _ = await _setup(session)
        await task_service.add_task(session, user, "داخل", day=WEEK_END)
        await task_service.add_task(
            session, user, "خارج", day=WEEK_END + timedelta(days=3)
        )

        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        assert result.tasks_total == 1

    async def test_percentage(self, session):
        user, _ = await _setup(session)
        _, first = await task_service.add_task(session, user, "أ", day=WEEK_END)
        await task_service.add_task(session, user, "ب", day=WEEK_END)
        first.is_done = True
        await session.flush()

        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        assert result.tasks_pct == 50.0

    async def test_recurring_task_counts_once_per_day(self, session):
        user, _ = await _setup(session)
        await task_service.add_task(
            session, user, "مذاكرة", day=WEEK_START, recurrence=Recurrence.DAILY
        )
        for offset in range(7):
            await task_service.materialize_day(
                session, user, WEEK_START + timedelta(days=offset)
            )

        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        assert result.tasks_total == 7


class TestHabitStats:
    async def test_done_days_and_percentage(self, session):
        user, habits = await _setup(session)
        water = habits["شرب المياه"]
        for offset in range(3):
            await habit_service.record(
                session, user, water.id, day=WEEK_START + timedelta(days=offset), delta=3.0
            )

        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        stat = next(s for s in result.habit_stats if s.habit.id == water.id)
        assert stat.done_days == 3
        assert stat.active_days == 7
        assert round(stat.pct) == 43

    async def test_stretch_days_are_counted_separately(self, session):
        user, habits = await _setup(session)
        reading = habits["قراءة في كتاب"]
        await habit_service.record(session, user, reading.id, day=WEEK_START, delta=5.0)
        await habit_service.record(
            session, user, reading.id, day=WEEK_START + timedelta(days=1), delta=2.0
        )

        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        stat = next(s for s in result.habit_stats if s.habit.id == reading.id)
        assert stat.done_days == 2
        assert stat.stretch_days == 1

    async def test_stats_are_ranked_by_percentage(self, session):
        user, habits = await _setup(session)
        await habit_service.record(
            session, user, habits["شرب المياه"].id, day=WEEK_START, delta=3.0
        )
        await habit_service.record(
            session, user, habits["شرب المياه"].id,
            day=WEEK_START + timedelta(days=1), delta=3.0,
        )
        await habit_service.record(
            session, user, habits["غسل الأسنان قبل النوم"].id, day=WEEK_START
        )

        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        assert result.habit_stats[0].habit.name == "شرب المياه"

    async def test_habit_active_on_some_days_has_smaller_denominator(self, session):
        user, habits = await _setup(session)
        gym = habits["قراءة في كتاب"]
        gym.active_days = [5, 0]  # السبت والاثنين
        await session.flush()

        result = await progress_service.summarize(session, user, WEEK_START, WEEK_END)
        stat = next(s for s in result.habit_stats if s.habit.id == gym.id)
        assert stat.active_days == 2


class TestCompare:
    async def test_previous_period_has_the_same_length(self, session):
        user, _ = await _setup(session)
        current, previous = await progress_service.compare(
            session, user, WEEK_START, WEEK_END
        )
        assert (current.end - current.start) == (previous.end - previous.start)
        assert previous.end == WEEK_START - timedelta(days=1)

    async def test_previous_week_data_is_separated(self, session):
        user, _ = await _setup(session)
        await task_service.add_task(session, user, "هذا الأسبوع", day=WEEK_END)
        await task_service.add_task(
            session, user, "الأسبوع الماضي", day=WEEK_START - timedelta(days=2)
        )

        current, previous = await progress_service.compare(
            session, user, WEEK_START, WEEK_END
        )
        assert current.tasks_total == 1
        assert previous.tasks_total == 1


class TestDeltaNote:
    def test_no_data_gives_nothing(self):
        assert progress_service.delta_note(0.0, 0.0) is None

    def test_improvement(self):
        assert "أحسن بـ 20%" in progress_service.delta_note(70.0, 50.0)

    def test_decline(self):
        assert "أقل بـ 20%" in progress_service.delta_note(50.0, 70.0)

    def test_flat(self):
        assert progress_service.delta_note(50.4, 50.0) == "زي الفترة اللي فاتت"
