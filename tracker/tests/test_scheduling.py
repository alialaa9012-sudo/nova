"""اختبارات طابور التذكيرات: البناء، التكرار، وإعادة الجدولة بعد تغيير المواعيد."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from tracker.db.models import Reminder, ReminderKind, Schedule
from tracker.services import scheduling
from tracker.services.bootstrap import get_or_create_user

CAIRO = ZoneInfo("Africa/Cairo")

FRIDAY = date(2026, 8, 28)     # نهاية الأسبوع (الأسبوع يبدأ السبت)
SATURDAY = date(2026, 8, 29)
SUNDAY = date(2026, 8, 30)
END_OF_MONTH = date(2026, 8, 31)


# الجدول يبدأ سريانه قبل كل أيام الاختبار حتى تُغطّى جميعها
SCHEDULE_START = date(2026, 8, 1)


async def _user(session, tid=6493959847, today=SCHEDULE_START):
    user, _ = await get_or_create_user(session, tid, first_name="Ali", today=today)
    return user


async def _kinds(session, user, day):
    rows = (
        await session.scalars(
            select(Reminder).where(
                Reminder.user_id == user.id, Reminder.for_day == day
            )
        )
    ).all()
    return {r.kind for r in rows}


class TestEnsureDay:
    async def test_creates_the_three_daily_reminders(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, SUNDAY, CAIRO)

        assert await _kinds(session, user, SUNDAY) == {
            ReminderKind.MORNING,
            ReminderKind.MIDDAY,
            ReminderKind.REVIEW,
        }

    async def test_uses_the_configured_times(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, SUNDAY, CAIRO)

        rows = {
            r.kind: r
            for r in (
                await session.scalars(
                    select(Reminder).where(Reminder.for_day == SUNDAY)
                )
            ).all()
        }
        assert rows[ReminderKind.MORNING].due_at.hour == 11
        assert rows[ReminderKind.MIDDAY].due_at.hour == 15

    async def test_midnight_review_lands_on_the_next_calendar_day(self, session):
        """المراجعة 12:00 تخصّ يوم السبت لكنها تقع فعلياً فجر الأحد."""
        user = await _user(session)
        await scheduling.ensure_day(session, user, SATURDAY, CAIRO)

        review = await session.scalar(
            select(Reminder).where(
                Reminder.for_day == SATURDAY, Reminder.kind == ReminderKind.REVIEW
            )
        )
        assert review.due_at.date() == SUNDAY
        assert review.due_at.hour == 0

    async def test_is_idempotent(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, SUNDAY, CAIRO)
        await scheduling.ensure_day(session, user, SUNDAY, CAIRO)
        await scheduling.ensure_day(session, user, SUNDAY, CAIRO)

        count = await session.scalar(
            select(func.count()).select_from(Reminder).where(Reminder.for_day == SUNDAY)
        )
        assert count == 3

    async def test_paused_user_gets_nothing(self, session):
        user = await _user(session)
        user.is_paused = True
        await session.flush()

        assert await scheduling.ensure_day(session, user, SUNDAY, CAIRO) == []

    async def test_optional_midday_can_be_switched_off(self, session):
        user = await _user(session)
        schedule = await session.scalar(select(Schedule).where(Schedule.user_id == user.id))
        schedule.midday_time = None
        await session.flush()

        await scheduling.ensure_day(session, user, SUNDAY, CAIRO)
        assert ReminderKind.MIDDAY not in await _kinds(session, user, SUNDAY)


class TestWeeklyAndMonthly:
    async def test_week_end_adds_report_and_schedule_question(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, FRIDAY, CAIRO)

        kinds = await _kinds(session, user, FRIDAY)
        assert ReminderKind.WEEKLY_REPORT in kinds
        assert ReminderKind.SCHEDULE_ASK in kinds

    async def test_midweek_day_has_no_weekly_extras(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, SUNDAY, CAIRO)

        kinds = await _kinds(session, user, SUNDAY)
        assert ReminderKind.WEEKLY_REPORT not in kinds
        assert ReminderKind.SCHEDULE_ASK not in kinds

    async def test_last_day_of_month_adds_monthly_report(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, END_OF_MONTH, CAIRO)

        assert ReminderKind.MONTHLY_REPORT in await _kinds(session, user, END_OF_MONTH)

    async def test_weekly_extras_ride_along_with_the_review_time(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, FRIDAY, CAIRO)

        rows = {
            r.kind: r.due_at
            for r in (
                await session.scalars(select(Reminder).where(Reminder.for_day == FRIDAY))
            ).all()
        }
        assert rows[ReminderKind.WEEKLY_REPORT] == rows[ReminderKind.REVIEW]


class TestHorizon:
    async def test_prepares_today_and_the_next_days(self, session):
        user = await _user(session)
        await scheduling.ensure_horizon(session, user, SATURDAY, CAIRO)

        for offset in range(scheduling.LOOKAHEAD_DAYS + 1):
            day = SATURDAY + timedelta(days=offset)
            assert ReminderKind.MORNING in await _kinds(session, user, day)


class TestDueNow:
    async def test_returns_only_past_due_unsent(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, SATURDAY, CAIRO)

        # 11:30 صباحاً: رسالة اليوم استحقّت، وتذكير 3 عصراً لا
        now = datetime(2026, 8, 29, 11, 30, tzinfo=CAIRO)
        due = await scheduling.due_now(session, now)
        assert [r.kind for r in due] == [ReminderKind.MORNING]

    async def test_sent_reminders_are_not_returned_again(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, SATURDAY, CAIRO)
        now = datetime(2026, 8, 29, 11, 30, tzinfo=CAIRO)

        due = await scheduling.due_now(session, now)
        scheduling.mark_sent(due[0], now)
        await session.flush()

        assert await scheduling.due_now(session, now) == []

    async def test_orders_oldest_first(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, SATURDAY, CAIRO)
        now = datetime(2026, 8, 29, 23, 0, tzinfo=CAIRO)

        due = await scheduling.due_now(session, now)
        assert [r.kind for r in due] == [ReminderKind.MORNING, ReminderKind.MIDDAY]


class TestReschedule:
    async def test_moves_unsent_reminders_to_the_new_time(self, session):
        user = await _user(session)
        await scheduling.ensure_horizon(session, user, SATURDAY, CAIRO)

        session.add(
            Schedule(
                user_id=user.id,
                effective_from=SATURDAY,
                morning_time=time(9, 0),
                midday_time=time(14, 0),
                review_time=time(23, 0),
            )
        )
        await session.flush()
        await scheduling.reschedule_from(session, user, SATURDAY, CAIRO)

        morning = await session.scalar(
            select(Reminder).where(
                Reminder.for_day == SATURDAY, Reminder.kind == ReminderKind.MORNING
            )
        )
        assert morning.due_at.hour == 9

    async def test_already_sent_reminders_are_kept(self, session):
        user = await _user(session)
        await scheduling.ensure_horizon(session, user, SATURDAY, CAIRO)

        sent = await session.scalar(
            select(Reminder).where(
                Reminder.for_day == SATURDAY, Reminder.kind == ReminderKind.MORNING
            )
        )
        scheduling.mark_sent(sent, datetime(2026, 8, 29, 11, 0, tzinfo=CAIRO))
        await session.flush()

        session.add(
            Schedule(
                user_id=user.id,
                effective_from=SATURDAY,
                morning_time=time(9, 0),
                midday_time=time(14, 0),
                review_time=time(23, 0),
            )
        )
        await session.flush()
        await scheduling.reschedule_from(session, user, SATURDAY, CAIRO)

        rows = (
            await session.scalars(
                select(Reminder).where(
                    Reminder.for_day == SATURDAY, Reminder.kind == ReminderKind.MORNING
                )
            )
        ).all()
        # الرسالة التي أُرسلت لم تُستنسخ ولم تُحذف
        assert len(rows) == 1
        assert rows[0].is_sent is True

    async def test_earlier_days_are_untouched(self, session):
        user = await _user(session)
        await scheduling.ensure_day(session, user, FRIDAY, CAIRO)
        await scheduling.ensure_horizon(session, user, SATURDAY, CAIRO)

        await scheduling.reschedule_from(session, user, SATURDAY, CAIRO)
        assert ReminderKind.MORNING in await _kinds(session, user, FRIDAY)


class TestPause:
    async def test_cancel_day_clears_future_unsent(self, session):
        user = await _user(session)
        await scheduling.ensure_horizon(session, user, SATURDAY, CAIRO)

        await scheduling.cancel_day(session, user, SATURDAY)
        remaining = await session.scalar(
            select(func.count()).select_from(Reminder).where(Reminder.user_id == user.id)
        )
        assert remaining == 0


class TestScheduleCoverage:
    async def test_day_before_any_schedule_gets_no_reminders(self, session):
        """لا نخترع مواعيد ليومٍ سبق وجود المستخدم."""
        user = await _user(session, today=SATURDAY)
        assert await scheduling.ensure_day(session, user, FRIDAY, CAIRO) == []
        assert await _kinds(session, user, FRIDAY) == set()
