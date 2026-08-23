"""اختبارات العادات: العتبات، السلاسل، والقاموس."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from tracker.db.models import Habit, HabitKind, HabitLog, VocabEntry
from tracker.services import habits as habit_service
from tracker.services.bootstrap import get_or_create_user

FRIDAY = date(2026, 8, 28)
SATURDAY = date(2026, 8, 29)


async def _setup(session, tid=6493959847):
    user, _ = await get_or_create_user(session, tid, first_name="Ali", today=FRIDAY)
    habits = {
        h.name: h
        for h in (
            await session.scalars(select(Habit).where(Habit.user_id == user.id))
        ).all()
    }
    return user, habits


class TestSeededHabitShapes:
    async def test_water_is_a_counter_of_three_litres(self, session):
        _, habits = await _setup(session)
        water = habits["شرب المياه"]
        assert water.kind is HabitKind.COUNTER
        assert water.target_value == 3.0
        assert water.unit == "لتر"
        assert water.stretch_value is None

    async def test_teeth_is_boolean(self, session):
        _, habits = await _setup(session)
        assert habits["غسل الأسنان قبل النوم"].kind is HabitKind.BOOLEAN

    async def test_reading_has_two_thresholds(self, session):
        _, habits = await _setup(session)
        reading = habits["قراءة في كتاب"]
        assert reading.target_value == 2.0
        assert reading.stretch_value == 5.0


class TestCounterRecording:
    async def test_partial_value_is_not_done(self, session):
        user, habits = await _setup(session)
        log = await habit_service.record(
            session, user, habits["شرب المياه"].id, day=FRIDAY, delta=1.5
        )
        assert log.value == 1.5
        assert log.is_done is False

    async def test_reaching_target_marks_done(self, session):
        user, habits = await _setup(session)
        water = habits["شرب المياه"].id
        await habit_service.record(session, user, water, day=FRIDAY, delta=1.5)
        log = await habit_service.record(session, user, water, day=FRIDAY, delta=1.5)
        assert log.value == 3.0
        assert log.is_done is True

    async def test_absolute_value_replaces_instead_of_adding(self, session):
        user, habits = await _setup(session)
        water = habits["شرب المياه"].id
        await habit_service.record(session, user, water, day=FRIDAY, delta=2.0)
        log = await habit_service.record(session, user, water, day=FRIDAY, absolute=1.0)
        assert log.value == 1.0

    async def test_value_never_goes_below_zero(self, session):
        user, habits = await _setup(session)
        log = await habit_service.record(
            session, user, habits["شرب المياه"].id, day=FRIDAY, delta=-5.0
        )
        assert log.value == 0.0

    async def test_days_are_independent(self, session):
        user, habits = await _setup(session)
        water = habits["شرب المياه"].id
        await habit_service.record(session, user, water, day=FRIDAY, delta=3.0)
        saturday = await habit_service.record(session, user, water, day=SATURDAY, delta=1.0)
        assert saturday.value == 1.0
        assert saturday.is_done is False


class TestReadingThresholds:
    async def test_two_pages_is_done_but_not_stretch(self, session):
        user, habits = await _setup(session)
        log = await habit_service.record(
            session, user, habits["قراءة في كتاب"].id, day=FRIDAY, delta=2.0
        )
        assert log.is_done is True
        assert log.is_stretch is False

    async def test_one_page_is_not_done(self, session):
        user, habits = await _setup(session)
        log = await habit_service.record(
            session, user, habits["قراءة في كتاب"].id, day=FRIDAY, delta=1.0
        )
        assert log.is_done is False

    async def test_five_pages_earns_stretch(self, session):
        user, habits = await _setup(session)
        log = await habit_service.record(
            session, user, habits["قراءة في كتاب"].id, day=FRIDAY, delta=5.0
        )
        assert log.is_done is True
        assert log.is_stretch is True

    async def test_water_never_gets_stretch(self, session):
        user, habits = await _setup(session)
        log = await habit_service.record(
            session, user, habits["شرب المياه"].id, day=FRIDAY, delta=10.0
        )
        assert log.is_done is True
        assert log.is_stretch is False


class TestBooleanHabit:
    async def test_tap_toggles_on_and_off(self, session):
        user, habits = await _setup(session)
        teeth = habits["غسل الأسنان قبل النوم"].id

        on = await habit_service.record(session, user, teeth, day=FRIDAY)
        assert on.is_done is True

        off = await habit_service.record(session, user, teeth, day=FRIDAY)
        assert off.is_done is False


class TestOwnership:
    async def test_cannot_record_another_users_habit(self, session):
        owner, habits = await _setup(session, 111)
        other, _ = await _setup(session, 222)
        assert (
            await habit_service.record(
                session, other, habits["شرب المياه"].id, day=FRIDAY, delta=1.0
            )
            is None
        )


class TestCompletion:
    async def test_none_done_is_zero(self, session):
        user, _ = await _setup(session)
        state = await habit_service.day_state(session, user, FRIDAY)
        assert habit_service.completion(state) == (0, 4, 0.0)

    async def test_two_of_four(self, session):
        user, habits = await _setup(session)
        await habit_service.record(session, user, habits["شرب المياه"].id, day=FRIDAY, delta=3.0)
        await habit_service.record(session, user, habits["غسل الأسنان قبل النوم"].id, day=FRIDAY)

        state = await habit_service.day_state(session, user, FRIDAY)
        done, total, pct = habit_service.completion(state)
        assert (done, total) == (2, 4)
        assert pct == 50.0

    async def test_habit_inactive_on_this_weekday_is_excluded(self, session):
        user, habits = await _setup(session)
        habits["شرب المياه"].active_days = [5]  # السبت فقط
        await session.flush()

        friday_state = await habit_service.day_state(session, user, FRIDAY)
        assert len(friday_state) == 3
        saturday_state = await habit_service.day_state(session, user, SATURDAY)
        assert len(saturday_state) == 4


class TestStreak:
    async def test_no_logs_is_zero(self, session):
        user, habits = await _setup(session)
        assert await habit_service.streak(session, habits["شرب المياه"], FRIDAY) == 0

    async def test_counts_consecutive_done_days(self, session):
        user, habits = await _setup(session)
        water = habits["شرب المياه"]
        for offset in range(3):
            await habit_service.record(
                session, user, water.id, day=FRIDAY - timedelta(days=offset), delta=3.0
            )
        assert await habit_service.streak(session, water, FRIDAY) == 3

    async def test_a_missed_day_breaks_the_streak(self, session):
        user, habits = await _setup(session)
        water = habits["شرب المياه"]
        await habit_service.record(session, user, water.id, day=FRIDAY, delta=3.0)
        # لا شيء يوم الخميس
        await habit_service.record(
            session, user, water.id, day=FRIDAY - timedelta(days=2), delta=3.0
        )
        assert await habit_service.streak(session, water, FRIDAY) == 1

    async def test_partial_day_does_not_count(self, session):
        user, habits = await _setup(session)
        water = habits["شرب المياه"]
        await habit_service.record(session, user, water.id, day=FRIDAY, delta=1.0)
        assert await habit_service.streak(session, water, FRIDAY) == 0

    async def test_inactive_weekdays_do_not_break_the_streak(self, session):
        user, habits = await _setup(session)
        gym = habits["قراءة في كتاب"]
        gym.active_days = [4, 5]  # الجمعة والسبت فقط
        await session.flush()

        await habit_service.record(session, user, gym.id, day=FRIDAY, delta=2.0)
        await habit_service.record(
            session, user, gym.id, day=FRIDAY - timedelta(days=6), delta=2.0
        )  # السبت السابق
        assert await habit_service.streak(session, gym, FRIDAY) == 2


class TestVocabulary:
    async def test_saving_a_sentence_stores_it_and_counts_it(self, session):
        user, habits = await _setup(session)
        vocab = habits["حفظ جمل إنجليزية"]

        result = await habit_service.add_vocab_entry(
            session, user, vocab.id, "The weather is lovely today", day=FRIDAY
        )
        assert result is not None
        entry, log = result
        assert entry.content == "The weather is lovely today"
        assert entry.entry_date == FRIDAY
        assert log.value == 1.0

    async def test_five_sentences_complete_the_habit(self, session):
        user, habits = await _setup(session)
        vocab = habits["حفظ جمل إنجليزية"].id
        for i in range(5):
            _, log = await habit_service.add_vocab_entry(
                session, user, vocab, f"sentence {i}", day=FRIDAY
            )
        assert log.value == 5.0
        assert log.is_done is True

    async def test_blank_sentence_is_rejected(self, session):
        user, habits = await _setup(session)
        result = await habit_service.add_vocab_entry(
            session, user, habits["حفظ جمل إنجليزية"].id, "   ", day=FRIDAY
        )
        assert result is None
        assert await session.scalar(select(VocabEntry)) is None

    async def test_entries_are_listed_newest_first(self, session):
        user, habits = await _setup(session)
        vocab = habits["حفظ جمل إنجليزية"].id
        await habit_service.add_vocab_entry(session, user, vocab, "older", day=FRIDAY - timedelta(days=1))
        await habit_service.add_vocab_entry(session, user, vocab, "newer", day=FRIDAY)

        entries = await habit_service.vocab_entries(session, user)
        assert [e.content for e in entries] == ["newer", "older"]

    async def test_entries_can_be_filtered_by_week(self, session):
        user, habits = await _setup(session)
        vocab = habits["حفظ جمل إنجليزية"].id
        await habit_service.add_vocab_entry(session, user, vocab, "this week", day=FRIDAY)
        await habit_service.add_vocab_entry(
            session, user, vocab, "last month", day=FRIDAY - timedelta(days=40)
        )

        recent = await habit_service.vocab_entries(
            session, user, since=FRIDAY - timedelta(days=6), until=FRIDAY
        )
        assert [e.content for e in recent] == ["this week"]
