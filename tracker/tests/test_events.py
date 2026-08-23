"""اختبارات الأحداث: قراءة النص، الجدولة، والتذكير."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from tracker.bot.keyboards import DayCB, EventCB
from tracker.db import session as session_module
from tracker.db.models import Event, Reminder, ReminderKind, Task, User
from tracker.services import reminders as reminder_service
from tracker.services.parsing import parse_event
from tracker.tests.fake_telegram import callback_update, text_update

ALLOWED_ID = 6493959847
CAIRO = ZoneInfo("Africa/Cairo")
FRIDAY = date(2026, 8, 28)


class TestParseEvent:
    def test_relative_tomorrow(self):
        parsed = parse_event("اجتماع مع الفريق بكرة 10 ص", FRIDAY)
        assert parsed.title == "اجتماع مع الفريق"
        assert parsed.event_date == date(2026, 8, 29)
        assert parsed.event_time == time(10, 0)

    def test_today_is_the_default(self):
        parsed = parse_event("مكالمة 6 م", FRIDAY)
        assert parsed.event_date == FRIDAY
        assert parsed.event_time == time(18, 0)

    def test_day_after_tomorrow_beats_tomorrow(self):
        """«بعد بكرة» يجب ألا تُقرأ كـ«بكرة» لأنها تحتويها."""
        parsed = parse_event("سفر بعد بكرة", FRIDAY)
        assert parsed.event_date == date(2026, 8, 30)
        assert parsed.title == "سفر"

    def test_weekday_resolves_to_the_next_one(self):
        parsed = parse_event("تسليم المشروع الخميس 3 م", FRIDAY)
        assert parsed.event_date == date(2026, 9, 3)  # الخميس التالي
        assert parsed.event_time == time(15, 0)

    def test_explicit_date(self):
        parsed = parse_event("دكتور 25/9 6 م", FRIDAY)
        assert parsed.event_date == date(2026, 9, 25)
        assert parsed.event_time == time(18, 0)

    def test_explicit_date_with_year(self):
        parsed = parse_event("موعد 5/1/2027", FRIDAY)
        assert parsed.event_date == date(2027, 1, 5)

    def test_invalid_date_stays_in_the_title(self):
        parsed = parse_event("مهمة 45/99", FRIDAY)
        assert parsed.event_date == FRIDAY

    def test_no_title_returns_none(self):
        assert parse_event("بكرة", FRIDAY) is None

    def test_event_without_time(self):
        parsed = parse_event("إجازة بكرة", FRIDAY)
        assert parsed.event_time is None


class TestEventFlow:
    async def _seed(self, dispatcher, bot):
        await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))

    async def test_event_command_then_text_creates_an_event(self, wired):
        dispatcher, bot, recorder = wired
        await self._seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/event", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(
            bot, text_update("اجتماع مع الفريق بكرة 10 ص", ALLOWED_ID, update_id=3)
        )

        async with session_module.session_scope() as s:
            event = await s.scalar(select(Event))
            assert event.title == "اجتماع مع الفريق"
            assert event.event_time == time(10, 0)
            # ولم تتحوّل إلى مهمة
            assert await s.scalar(select(Task)) is None

    async def test_event_button_opens_the_same_flow(self, wired):
        dispatcher, bot, recorder = wired
        await self._seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(
            bot, callback_update(DayCB(action="add_event").pack(), ALLOWED_ID, update_id=2)
        )

        assert "اكتب الحدث" in recorder.sent_texts[0]

    async def test_event_with_a_time_gets_a_reminder(self, wired):
        dispatcher, bot, _ = wired
        await self._seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/event", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(
            bot, text_update("اجتماع بعد بكرة 10 ص", ALLOWED_ID, update_id=3)
        )

        async with session_module.session_scope() as s:
            reminder = await s.scalar(
                select(Reminder).where(Reminder.kind == ReminderKind.EVENT)
            )
            assert reminder is not None
            assert reminder.due_at.hour == 9
            assert reminder.due_at.minute == 30

    async def test_event_without_a_time_gets_no_reminder(self, wired):
        dispatcher, bot, _ = wired
        await self._seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/event", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(
            bot, text_update("إجازة بعد بكرة", ALLOWED_ID, update_id=3)
        )

        async with session_module.session_scope() as s:
            assert (
                await s.scalar(select(Reminder).where(Reminder.kind == ReminderKind.EVENT))
                is None
            )

    async def test_changing_the_lead_reschedules(self, wired):
        dispatcher, bot, _ = wired
        await self._seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/event", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(
            bot, text_update("اجتماع بعد بكرة 10 ص", ALLOWED_ID, update_id=3)
        )

        async with session_module.session_scope() as s:
            event_id = await s.scalar(select(Event.id))

        await dispatcher.feed_update(
            bot,
            callback_update(
                EventCB(action="lead", event_id=event_id, value=60).pack(),
                ALLOWED_ID,
                update_id=4,
            ),
        )

        async with session_module.session_scope() as s:
            reminders = (
                await s.scalars(
                    select(Reminder).where(Reminder.kind == ReminderKind.EVENT)
                )
            ).all()
            assert len(reminders) == 1
            assert reminders[0].due_at.hour == 9
            assert reminders[0].due_at.minute == 0

    async def test_deleting_an_event_drops_its_reminder(self, wired):
        dispatcher, bot, _ = wired
        await self._seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/event", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(
            bot, text_update("اجتماع بعد بكرة 10 ص", ALLOWED_ID, update_id=3)
        )

        async with session_module.session_scope() as s:
            event_id = await s.scalar(select(Event.id))

        await dispatcher.feed_update(
            bot,
            callback_update(
                EventCB(action="delete", event_id=event_id, value=0).pack(),
                ALLOWED_ID,
                update_id=4,
            ),
        )

        async with session_module.session_scope() as s:
            assert await s.scalar(select(Event)) is None
            assert (
                await s.scalar(select(Reminder).where(Reminder.kind == ReminderKind.EVENT))
                is None
            )

    async def test_upcoming_events_appear_in_the_today_message(self, wired):
        dispatcher, bot, recorder = wired
        await self._seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/event", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(
            bot, text_update("اجتماع مع الفريق بكرة 10 ص", ALLOWED_ID, update_id=3)
        )
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=4))

        body = recorder.sent_texts[0]
        assert "الأحداث القادمة" in body
        assert "بكرة 10:00 ص — اجتماع مع الفريق" in body

    async def test_events_list_command(self, wired):
        dispatcher, bot, recorder = wired
        await self._seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/events", ALLOWED_ID, update_id=2))

        assert "مفيش أحداث قادمة" in recorder.sent_texts[0]

    async def test_event_reminder_is_delivered(self, wired):
        dispatcher, bot, recorder = wired
        await self._seed(dispatcher, bot)

        async with session_module.session_scope() as s:
            from tracker.services import events as event_service

            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            future = datetime.now(CAIRO) + timedelta(days=1)
            await event_service.add(
                s,
                user,
                "اجتماع العميل",
                event_date=future.date(),
                event_time=time(10, 0),
                tz=CAIRO,
            )

        recorder.clear()
        async with session_module.session_scope() as s:
            due = datetime.combine(
                (datetime.now(CAIRO) + timedelta(days=1)).date(),
                time(9, 35),
                tzinfo=CAIRO,
            )
            await reminder_service.run_tick(bot, s, due)

        assert any("اجتماع العميل" in t for t in recorder.sent_texts)
