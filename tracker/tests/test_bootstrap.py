"""اختبارات تهيئة المستخدم لأول مرة."""

from datetime import date, time

import pytest
from sqlalchemy import select

from tracker.db.models import Habit, HabitKind, Schedule
from tracker.services.bootstrap import current_schedule, get_or_create_user

pytestmark = pytest.mark.asyncio


async def test_creates_user_with_defaults(session):
    user, created = await get_or_create_user(
        session, 6493959847, first_name="Ali", today=date(2026, 8, 28)
    )
    assert created is True
    assert user.telegram_id == 6493959847
    assert user.first_name == "Ali"
    assert user.timezone == "Africa/Cairo"
    assert user.week_start == 5      # السبت
    assert user.day_boundary_hour == 4
    assert user.is_paused is False


async def test_seeds_exactly_four_habits(session):
    user, _ = await get_or_create_user(session, 111, today=date(2026, 8, 28))
    habits = (
        await session.scalars(
            select(Habit).where(Habit.user_id == user.id).order_by(Habit.sort_order)
        )
    ).all()

    assert [h.name for h in habits] == [
        "شرب المياه",
        "غسل الأسنان قبل النوم",
        "قراءة في كتاب",
        "حفظ جمل إنجليزية",
    ]


async def test_reading_habit_has_target_and_stretch(session):
    user, _ = await get_or_create_user(session, 222, today=date(2026, 8, 28))
    reading = await session.scalar(
        select(Habit).where(Habit.user_id == user.id, Habit.name == "قراءة في كتاب")
    )
    assert reading.target_value == 2.0   # صفحتان = تمام
    assert reading.stretch_value == 5.0  # خمس صفحات = ممتاز


async def test_vocab_habit_captures_text(session):
    user, _ = await get_or_create_user(session, 333, today=date(2026, 8, 28))
    vocab = await session.scalar(
        select(Habit).where(Habit.user_id == user.id, Habit.name == "حفظ جمل إنجليزية")
    )
    assert vocab.captures_text is True
    assert vocab.target_value == 5.0

    teeth = await session.scalar(
        select(Habit).where(Habit.user_id == user.id, Habit.kind == HabitKind.BOOLEAN)
    )
    assert teeth.captures_text is False


async def test_seeds_default_schedule(session):
    user, _ = await get_or_create_user(session, 444, today=date(2026, 8, 28))
    schedule = await session.scalar(
        select(Schedule).where(Schedule.user_id == user.id)
    )
    assert schedule.morning_time == time(11, 0)
    assert schedule.midday_time == time(15, 0)
    assert schedule.review_time == time(0, 0)


async def test_second_call_returns_same_user_without_duplicating(session):
    first, created_first = await get_or_create_user(session, 555, today=date(2026, 8, 28))
    await session.commit()
    second, created_second = await get_or_create_user(session, 555, today=date(2026, 8, 29))

    assert created_first is True
    assert created_second is False
    assert first.id == second.id

    habits = (await session.scalars(select(Habit).where(Habit.user_id == first.id))).all()
    assert len(habits) == 4


async def test_current_schedule_picks_latest_effective(session):
    user, _ = await get_or_create_user(session, 666, today=date(2026, 8, 22))
    session.add(
        Schedule(
            user_id=user.id,
            effective_from=date(2026, 8, 29),
            morning_time=time(9, 0),
            midday_time=time(14, 0),
            review_time=time(23, 0),
        )
    )
    await session.flush()

    before = await current_schedule(session, user.id, date(2026, 8, 28))
    after = await current_schedule(session, user.id, date(2026, 8, 30))

    assert before.morning_time == time(11, 0)
    assert after.morning_time == time(9, 0)


async def test_current_schedule_none_before_any_schedule(session):
    user, _ = await get_or_create_user(session, 777, today=date(2026, 8, 28))
    assert await current_schedule(session, user.id, date(2026, 8, 1)) is None


async def test_large_telegram_id_survives_roundtrip(session):
    """معرّفات تليجرام تتجاوز سعة INTEGER — لا بد أن يقبلها العمود بلا اقتطاع."""
    big_id = 6493959847  # أكبر من 2^31-1
    user, _ = await get_or_create_user(session, big_id, today=date(2026, 8, 28))
    await session.commit()

    from tracker.db.models import User

    stored = await session.scalar(select(User).where(User.telegram_id == big_id))
    assert stored is not None
    assert stored.telegram_id == big_id
