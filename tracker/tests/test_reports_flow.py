"""اختبار تكامل لتقارير الأسبوع والشهر."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from tracker.db import session as session_module
from tracker.db.models import Habit, ReminderKind, Schedule, User
from tracker.services import habits as habit_service
from tracker.services import reminders as reminder_service
from tracker.services import scheduling
from tracker.tests.fake_telegram import callback_update, text_update
from tracker.bot.keyboards import HabitCB

ALLOWED_ID = 6493959847
CAIRO = ZoneInfo("Africa/Cairo")
FRIDAY = date(2026, 8, 28)


async def _seed(dispatcher, bot):
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))


async def _current_day() -> date:
    from tracker.config import get_settings
    from tracker.services.timeutil import logical_date, now_in

    return logical_date(now_in(get_settings().tz))


class TestWeeklyCommand:
    async def test_week_report_shows_both_numbers(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة", ALLOWED_ID, update_id=2))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/week", ALLOWED_ID, update_id=3))

        body = recorder.sent_texts[0]
        assert "ملخص الأسبوع" in body
        assert "📋 <b>المهام</b>" in body
        assert "⚡ <b>العادات</b>" in body

    async def test_week_report_ranks_habits(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        today = await _current_day()

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            water = await s.scalar(select(Habit).where(Habit.name == "شرب المياه"))
            await habit_service.record(s, user, water.id, day=today, delta=3.0)

        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/week", ALLOWED_ID, update_id=2))

        body = recorder.sent_texts[0]
        assert "ترتيب العادات" in body
        assert "💧" in body

    async def test_week_report_includes_the_weeks_sentences(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)

        async with session_module.session_scope() as s:
            vocab_id = await s.scalar(
                select(Habit.id).where(Habit.name == "حفظ جمل إنجليزية")
            )

        for i, sentence in enumerate(["I woke up early", "She reads every night"]):
            await dispatcher.feed_update(
                bot,
                callback_update(
                    HabitCB(action="vocab", habit_id=vocab_id).pack(),
                    ALLOWED_ID,
                    update_id=10 + i * 2,
                ),
            )
            await dispatcher.feed_update(
                bot, text_update(sentence, ALLOWED_ID, update_id=11 + i * 2)
            )

        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/week", ALLOWED_ID, update_id=50))

        body = recorder.sent_texts[0]
        assert "جمل الأسبوع" in body
        assert "I woke up early" in body
        assert "She reads every night" in body


class TestMonthlyCommand:
    async def test_month_report_renders(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة", ALLOWED_ID, update_id=2))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/month", ALLOWED_ID, update_id=3))

        body = recorder.sent_texts[0]
        assert "ملخص الشهر" in body

    async def test_month_report_omits_the_sentence_review(self, wired):
        """مراجعة الجمل أسبوعية — لا معنى لتكرار الشهر كله فيها."""
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/month", ALLOWED_ID, update_id=2))

        assert "جمل الأسبوع" not in recorder.sent_texts[0]


class TestAutomaticReports:
    async def _prepare(self, dispatcher, bot, day: date):
        await _seed(dispatcher, bot)
        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            schedule = await s.scalar(select(Schedule).where(Schedule.user_id == user.id))
            schedule.effective_from = day - timedelta(days=30)
            await s.flush()
            await scheduling.ensure_day(s, user, day, CAIRO)

    async def test_weekly_report_rides_with_the_friday_review(self, wired):
        dispatcher, bot, recorder = wired
        await self._prepare(dispatcher, bot, FRIDAY)
        recorder.clear()

        async with session_module.session_scope() as s:
            # مراجعة الجمعة تقع فجر السبت
            await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 29, 0, 5, tzinfo=CAIRO)
            )

        joined = "\n".join(recorder.sent_texts)
        assert "مراجعة" in joined
        assert "ملخص الأسبوع" in joined
        assert "الأسبوع الجاي" in joined

    async def test_monthly_report_fires_on_the_last_day(self, wired):
        dispatcher, bot, recorder = wired
        end_of_month = date(2026, 8, 31)
        await self._prepare(dispatcher, bot, end_of_month)
        recorder.clear()

        async with session_module.session_scope() as s:
            await reminder_service.run_tick(
                bot, s, datetime(2026, 9, 1, 0, 5, tzinfo=CAIRO)
            )

        assert any("ملخص الشهر" in t for t in recorder.sent_texts)

    async def test_midweek_review_has_no_reports(self, wired):
        dispatcher, bot, recorder = wired
        sunday = date(2026, 8, 30)
        await self._prepare(dispatcher, bot, sunday)
        recorder.clear()

        async with session_module.session_scope() as s:
            await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 31, 0, 5, tzinfo=CAIRO)
            )

        joined = "\n".join(recorder.sent_texts)
        assert "مراجعة" in joined
        assert "ملخص الأسبوع" not in joined
        assert "ملخص الشهر" not in joined
