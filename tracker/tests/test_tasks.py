"""اختبارات منطق المهام: التكرار، التوليد، الإنجاز، والترحيل."""

from __future__ import annotations

from datetime import date, time
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import func, select

from tracker.db.models import Recurrence, Task, TaskInstance
from tracker.services.bootstrap import get_or_create_user
from tracker.services.tasks import (
    add_task,
    carry_unfinished,
    completion,
    day_pairs,
    materialize_day,
    occurs_on,
    toggle,
)

CAIRO = ZoneInfo("Africa/Cairo")

FRIDAY = date(2026, 8, 28)
SATURDAY = date(2026, 8, 29)
SUNDAY = date(2026, 8, 30)


async def _user(session, tid=6493959847):
    user, _ = await get_or_create_user(session, tid, first_name="Ali", today=FRIDAY)
    return user


class TestOccursOn:
    def test_daily_occurs_every_day(self):
        t = Task(title="x", recurrence=Recurrence.DAILY, is_active=True)
        assert occurs_on(t, FRIDAY) and occurs_on(t, SATURDAY)

    def test_one_off_only_on_its_date(self):
        t = Task(title="x", recurrence=Recurrence.NONE, due_date=FRIDAY, is_active=True)
        assert occurs_on(t, FRIDAY) is True
        assert occurs_on(t, SATURDAY) is False

    def test_custom_days_matches_weekday(self):
        # السبت=5، الأحد=6 بترقيم بايثون
        t = Task(title="x", recurrence=Recurrence.CUSTOM_DAYS, custom_days=[5, 6], is_active=True)
        assert occurs_on(t, SATURDAY) is True
        assert occurs_on(t, SUNDAY) is True
        assert occurs_on(t, FRIDAY) is False

    def test_custom_days_empty_never_occurs(self):
        t = Task(title="x", recurrence=Recurrence.CUSTOM_DAYS, custom_days=[], is_active=True)
        assert occurs_on(t, FRIDAY) is False

    def test_weekly_matches_anchor_weekday(self):
        t = Task(title="x", recurrence=Recurrence.WEEKLY, due_date=FRIDAY, is_active=True)
        assert occurs_on(t, FRIDAY) is True
        assert occurs_on(t, date(2026, 9, 4)) is True   # الجمعة التالية
        assert occurs_on(t, SATURDAY) is False

    def test_inactive_never_occurs(self):
        t = Task(title="x", recurrence=Recurrence.DAILY, is_active=False)
        assert occurs_on(t, FRIDAY) is False


class TestMaterialize:
    async def test_creates_one_instance_per_due_task(self, session):
        user = await _user(session)
        await add_task(session, user, "مذاكرة", day=FRIDAY, recurrence=Recurrence.DAILY)
        await add_task(session, user, "جيم", day=FRIDAY, recurrence=Recurrence.DAILY)

        instances = await materialize_day(session, user, SATURDAY)
        assert len(instances) == 2

    async def test_is_idempotent(self, session):
        user = await _user(session)
        await add_task(session, user, "مذاكرة", day=FRIDAY, recurrence=Recurrence.DAILY)

        await materialize_day(session, user, SATURDAY)
        await materialize_day(session, user, SATURDAY)
        await materialize_day(session, user, SATURDAY)

        count = await session.scalar(
            select(func.count())
            .select_from(TaskInstance)
            .where(TaskInstance.occurrence_date == SATURDAY)
        )
        assert count == 1

    async def test_preserves_done_state_across_calls(self, session):
        user = await _user(session)
        await add_task(session, user, "مذاكرة", day=FRIDAY, recurrence=Recurrence.DAILY)

        first = await materialize_day(session, user, FRIDAY)
        await toggle(session, user, first[0].id, tz=CAIRO)

        again = await materialize_day(session, user, FRIDAY)
        assert again[0].is_done is True

    async def test_excludes_tasks_not_due(self, session):
        user = await _user(session)
        await add_task(session, user, "اجتماع", day=FRIDAY, recurrence=Recurrence.NONE)

        assert len(await materialize_day(session, user, FRIDAY)) == 1
        assert len(await materialize_day(session, user, SATURDAY)) == 0

    async def test_orders_timed_before_untimed(self, session):
        user = await _user(session)
        await add_task(session, user, "بلا وقت", day=FRIDAY)
        await add_task(session, user, "متأخر", day=FRIDAY, scheduled_time=time(21, 0))
        await add_task(session, user, "مبكر", day=FRIDAY, scheduled_time=time(11, 0))

        pairs = await day_pairs(session, user, FRIDAY)
        assert [t.title for t, _ in pairs] == ["مبكر", "متأخر", "بلا وقت"]


class TestToggle:
    async def test_toggles_both_ways(self, session):
        user = await _user(session)
        _, inst = await add_task(session, user, "قراءة", day=FRIDAY)

        after_on = await toggle(session, user, inst.id, tz=CAIRO)
        assert after_on.is_done is True
        assert after_on.done_at is not None

        after_off = await toggle(session, user, inst.id, tz=CAIRO)
        assert after_off.is_done is False
        assert after_off.done_at is None

    async def test_refuses_another_users_instance(self, session):
        owner = await _user(session, 111)
        other = await _user(session, 222)
        _, inst = await add_task(session, owner, "خاصة", day=FRIDAY)

        assert await toggle(session, other, inst.id, tz=CAIRO) is None

    async def test_missing_instance_returns_none(self, session):
        user = await _user(session)
        assert await toggle(session, user, 999999, tz=CAIRO) is None


class TestCarryOver:
    async def test_carries_unfinished_one_off_task(self, session):
        user = await _user(session)
        await add_task(session, user, "مشروع العميل", day=FRIDAY)

        carried = await carry_unfinished(session, user, from_day=FRIDAY, to_day=SATURDAY)
        assert len(carried) == 1
        assert carried[0].carried_from_date == FRIDAY

        tomorrow = await day_pairs(session, user, SATURDAY)
        assert [t.title for t, _ in tomorrow] == ["مشروع العميل"]

    async def test_does_not_carry_finished_task(self, session):
        user = await _user(session)
        _, inst = await add_task(session, user, "خلصت", day=FRIDAY)
        await toggle(session, user, inst.id, tz=CAIRO)

        carried = await carry_unfinished(session, user, from_day=FRIDAY, to_day=SATURDAY)
        assert carried == []

    async def test_does_not_carry_recurring_task(self, session):
        """المتكررة تظهر بنفسها غداً — ترحيلها يُنتج نسختين."""
        user = await _user(session)
        await add_task(session, user, "مذاكرة", day=FRIDAY, recurrence=Recurrence.DAILY)

        carried = await carry_unfinished(session, user, from_day=FRIDAY, to_day=SATURDAY)
        assert carried == []

        tomorrow = await day_pairs(session, user, SATURDAY)
        assert len(tomorrow) == 1

    async def test_carrying_twice_does_not_duplicate(self, session):
        user = await _user(session)
        await add_task(session, user, "مشروع", day=FRIDAY)

        await carry_unfinished(session, user, from_day=FRIDAY, to_day=SATURDAY)
        await carry_unfinished(session, user, from_day=FRIDAY, to_day=SATURDAY)

        tomorrow = await day_pairs(session, user, SATURDAY)
        assert len(tomorrow) == 1


class TestCompletion:
    def test_empty_day_is_zero(self):
        assert completion([]) == (0, 0, 0.0)

    def test_half_done(self):
        pairs = [
            (Task(title="a"), TaskInstance(is_done=True)),
            (Task(title="b"), TaskInstance(is_done=False)),
        ]
        assert completion(pairs) == (1, 2, 50.0)

    def test_all_done(self):
        pairs = [(Task(title="a"), TaskInstance(is_done=True))]
        done, total, pct = completion(pairs)
        assert (done, total, pct) == (1, 1, 100.0)
