"""اختبار تكامل للمواعيد المرنة وتنفيذ طابور التذكيرات."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from tracker.bot.keyboards import ScheduleCB
from tracker.db import session as session_module
from tracker.db.models import Reminder, ReminderKind, Schedule, User
from tracker.services import reminders as reminder_service
from tracker.services import scheduling
from tracker.tests.fake_telegram import callback_update, text_update

ALLOWED_ID = 6493959847
CAIRO = ZoneInfo("Africa/Cairo")


async def _seed(dispatcher, bot):
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))


async def _schedule() -> Schedule:
    async with session_module.session_scope() as s:
        user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
        return await s.scalar(
            select(Schedule)
            .where(Schedule.user_id == user.id)
            .order_by(Schedule.effective_from.desc(), Schedule.id.desc())
        )


class TestViewingTimes:
    async def test_times_command_shows_the_three_slots(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/times", ALLOWED_ID, update_id=2))

        body = recorder.sent_texts[0]
        assert "11:00 ص" in body
        assert "3:00 م" in body
        assert "12:00 ص" in body

    async def test_arabic_word_works_as_a_command(self, wired):
        """تليجرام لا يقبل الأوامر العربية، فالكلمة تُقبل كنص عادي."""
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("مواعيد", ALLOWED_ID, update_id=2))

        assert "مواعيدك الحالية" in recorder.sent_texts[0]

    async def test_the_arabic_word_does_not_become_a_task(self, wired):
        from tracker.db.models import Task

        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مواعيد", ALLOWED_ID, update_id=2))

        async with session_module.session_scope() as s:
            assert await s.scalar(select(Task)) is None


class TestChangingTimes:
    async def test_editing_the_morning_time(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)

        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="edit", slot="morning").pack(), ALLOWED_ID, update_id=2
            ),
        )
        await dispatcher.feed_update(bot, text_update("9 ص", ALLOWED_ID, update_id=3))

        schedule = await _schedule()
        assert schedule.morning_time == time(9, 0)

    async def test_confirmation_reports_the_new_time(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="edit", slot="review").pack(), ALLOWED_ID, update_id=2
            ),
        )
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("23:30", ALLOWED_ID, update_id=3))

        assert "11:30 م" in recorder.sent_texts[0]

    async def test_unparseable_time_keeps_waiting(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="edit", slot="morning").pack(), ALLOWED_ID, update_id=2
            ),
        )
        await dispatcher.feed_update(bot, text_update("بكرة الصبح", ALLOWED_ID, update_id=3))

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            assert user.pending_action == "time:morning"

        # ثم المحاولة الثانية تنجح
        await dispatcher.feed_update(bot, text_update("10 ص", ALLOWED_ID, update_id=4))
        assert (await _schedule()).morning_time == time(10, 0)

    async def test_time_input_does_not_become_a_task(self, wired):
        from tracker.db.models import Task

        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="edit", slot="morning").pack(), ALLOWED_ID, update_id=2
            ),
        )
        await dispatcher.feed_update(bot, text_update("9 ص", ALLOWED_ID, update_id=3))

        async with session_module.session_scope() as s:
            assert await s.scalar(select(Task)) is None

    async def test_midday_can_be_switched_off(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="off", slot="midday").pack(), ALLOWED_ID, update_id=2
            ),
        )

        assert (await _schedule()).midday_time is None

    async def test_changing_a_time_moves_pending_reminders(self, wired):
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            today = user.today_message_date or date.today()
            await scheduling.ensure_horizon(s, user, today, CAIRO)

        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="edit", slot="morning").pack(), ALLOWED_ID, update_id=2
            ),
        )
        await dispatcher.feed_update(bot, text_update("7 ص", ALLOWED_ID, update_id=3))

        async with session_module.session_scope() as s:
            pending = (
                await s.scalars(
                    select(Reminder).where(
                        Reminder.kind == ReminderKind.MORNING,
                        Reminder.is_sent.is_(False),
                    )
                )
            ).all()
            assert pending
            assert all(r.due_at.hour == 7 for r in pending)


class TestWeeklyAsk:
    async def test_keeping_times_answers_without_changing_anything(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        before = (await _schedule()).morning_time
        recorder.clear()

        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="keep", slot="all").pack(), ALLOWED_ID, update_id=2
            ),
        )

        assert "زي ما هي" in recorder.sent_texts[0]
        assert (await _schedule()).morning_time == before

    async def test_opening_the_editor_shows_current_times(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()

        await dispatcher.feed_update(
            bot,
            callback_update(
                ScheduleCB(action="open", slot="all").pack(), ALLOWED_ID, update_id=2
            ),
        )

        assert "مواعيدك الحالية" in recorder.sent_texts[0]


class TestTick:
    async def _prepare(self, dispatcher, bot, day: date):
        await _seed(dispatcher, bot)
        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            schedule = await s.scalar(select(Schedule).where(Schedule.user_id == user.id))
            schedule.effective_from = day - timedelta(days=1)
            await s.flush()
            await scheduling.ensure_day(s, user, day, CAIRO)

    async def test_morning_reminder_sends_the_today_message(self, wired):
        dispatcher, bot, recorder = wired
        day = date(2026, 8, 29)
        await self._prepare(dispatcher, bot, day)
        recorder.clear()

        async with session_module.session_scope() as s:
            result = await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 29, 11, 5, tzinfo=CAIRO)
            )

        assert result.sent == 1
        assert "صباح الخير" in recorder.sent_texts[0]

    async def test_a_second_tick_does_not_resend(self, wired):
        dispatcher, bot, recorder = wired
        day = date(2026, 8, 29)
        await self._prepare(dispatcher, bot, day)
        now = datetime(2026, 8, 29, 11, 5, tzinfo=CAIRO)

        async with session_module.session_scope() as s:
            await reminder_service.run_tick(bot, s, now)
        recorder.clear()
        async with session_module.session_scope() as s:
            second = await reminder_service.run_tick(bot, s, now)

        assert second.sent == 0
        assert recorder.sent_texts == []

    async def test_midday_is_skipped_when_nothing_is_pending(self, wired):
        """لا رسالة بلا سبب — سقف الرسائل يُحترم بعدم الإرسال أصلاً."""
        dispatcher, bot, recorder = wired
        day = date(2026, 8, 29)
        await self._prepare(dispatcher, bot, day)

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            # اجعل العادات كلها منجزة ولا مهام أصلاً
            from tracker.db.models import Habit
            from tracker.services import habits as habit_service

            for habit in (await s.scalars(select(Habit).where(Habit.user_id == user.id))).all():
                await habit_service.record(
                    s, user, habit.id, day=day, absolute=habit.target_value
                )

        recorder.clear()
        async with session_module.session_scope() as s:
            await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 29, 15, 5, tzinfo=CAIRO)
            )

        assert not any("باقي معاك" in t for t in recorder.sent_texts)

    async def test_midday_lists_only_what_is_missing(self, wired):
        dispatcher, bot, recorder = wired
        day = date(2026, 8, 29)
        await self._prepare(dispatcher, bot, day)
        recorder.clear()

        async with session_module.session_scope() as s:
            await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 29, 15, 5, tzinfo=CAIRO)
            )

        nudge = next(t for t in recorder.sent_texts if "باقي معاك" in t)
        assert "شرب المياه" in nudge
        assert "غسل الأسنان قبل النوم" in nudge

    async def test_paused_user_receives_nothing(self, wired):
        dispatcher, bot, recorder = wired
        day = date(2026, 8, 29)
        await self._prepare(dispatcher, bot, day)

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            user.is_paused = True
        recorder.clear()

        async with session_module.session_scope() as s:
            result = await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 29, 23, 0, tzinfo=CAIRO)
            )

        assert result.sent == 0
        assert recorder.sent_texts == []

    async def test_tick_fills_the_upcoming_horizon(self, wired):
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)

        async with session_module.session_scope() as s:
            result = await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 29, 12, 0, tzinfo=CAIRO)
            )

        assert result.scheduled > 0
