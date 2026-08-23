"""اختبار تكامل للمراجعة الليلية: الترحيل، المزاج، والملخص السريع."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from tracker.bot.keyboards import DayCB, ReviewCB
from tracker.db import session as session_module
from tracker.db.models import DailyNote, DailyReview, Habit, Schedule, Task, TaskInstance, User
from tracker.services import habits as habit_service
from tracker.services import reminders as reminder_service
from tracker.services import scheduling
from tracker.tests.fake_telegram import callback_update, text_update

ALLOWED_ID = 6493959847
CAIRO = ZoneInfo("Africa/Cairo")


async def _seed(dispatcher, bot):
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))


async def _user_and_today() -> tuple[int, date]:
    async with session_module.session_scope() as s:
        user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
        return user.id, user.today_message_date or date.today()


async def _current_day() -> date:
    from tracker.config import get_settings
    from tracker.services.timeutil import logical_date, now_in

    return logical_date(now_in(get_settings().tz))


class TestReviewOnDemand:
    async def test_review_lists_done_and_missed(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة خلصت", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(bot, text_update("مهمة فاتت", ALLOWED_ID, update_id=3))

        async with session_module.session_scope() as s:
            inst = await s.scalar(select(TaskInstance).order_by(TaskInstance.id))
            inst.is_done = True

        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=4))

        body = recorder.sent_texts[0]
        assert "✅ مهمة خلصت" in body
        assert "⬜ مهمة فاتت" in body
        assert "1 من 2" in body

    async def test_review_shows_two_separate_numbers(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة", ALLOWED_ID, update_id=2))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=3))

        body = recorder.sent_texts[0]
        assert "📋 <b>المهام</b>" in body
        assert "⚡ <b>العادات</b>" in body
        assert body.count("%") == 2

    async def test_review_is_persisted(self, wired):
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=2))

        async with session_module.session_scope() as s:
            assert await s.scalar(select(DailyReview)) is not None

    async def test_streak_appears_after_two_days(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        today = await _current_day()

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            reading = await s.scalar(
                select(Habit).where(Habit.name == "قراءة في كتاب")
            )
            for offset in (0, 1):
                await habit_service.record(
                    s, user, reading.id, day=today - timedelta(days=offset), delta=2.0
                )

        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=2))

        assert "🔥" in recorder.sent_texts[0]
        assert "📖 2 أيام" in recorder.sent_texts[0]


class TestCarryOver:
    async def test_carry_button_moves_unfinished_to_tomorrow(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مشروع العميل", ALLOWED_ID, update_id=2))
        today = await _current_day()

        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=3))
        await dispatcher.feed_update(
            bot,
            callback_update(
                ReviewCB(action="carry", day=today.isoformat(), value=0).pack(),
                ALLOWED_ID,
                update_id=4,
            ),
        )

        async with session_module.session_scope() as s:
            tomorrow = await s.scalar(
                select(TaskInstance).where(
                    TaskInstance.occurrence_date == today + timedelta(days=1)
                )
            )
            assert tomorrow is not None
            assert tomorrow.carried_from_date == today

    async def test_carry_is_recorded_on_the_review(self, wired):
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مشروع", ALLOWED_ID, update_id=2))
        today = await _current_day()

        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=3))
        await dispatcher.feed_update(
            bot,
            callback_update(
                ReviewCB(action="carry", day=today.isoformat(), value=0).pack(),
                ALLOWED_ID,
                update_id=4,
            ),
        )

        async with session_module.session_scope() as s:
            review = await s.scalar(select(DailyReview))
            assert review.carried_task_ids

    async def test_skip_leaves_tomorrow_empty(self, wired):
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مشروع", ALLOWED_ID, update_id=2))
        today = await _current_day()

        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=3))
        await dispatcher.feed_update(
            bot,
            callback_update(
                ReviewCB(action="skip", day=today.isoformat(), value=0).pack(),
                ALLOWED_ID,
                update_id=4,
            ),
        )

        async with session_module.session_scope() as s:
            tomorrow = await s.scalar(
                select(TaskInstance).where(
                    TaskInstance.occurrence_date == today + timedelta(days=1)
                )
            )
            assert tomorrow is None

    async def test_no_carry_button_when_everything_is_done(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة", ALLOWED_ID, update_id=2))

        async with session_module.session_scope() as s:
            inst = await s.scalar(select(TaskInstance))
            inst.is_done = True

        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=3))

        send = next(c for c in recorder.calls if type(c).__name__ == "SendMessage")
        labels = [b.text for row in send.reply_markup.inline_keyboard for b in row]
        assert not any("رحّل" in label for label in labels)


class TestMood:
    async def test_mood_is_saved(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        today = await _current_day()
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=2))

        await dispatcher.feed_update(
            bot,
            callback_update(
                ReviewCB(action="mood", day=today.isoformat(), value=4).pack(),
                ALLOWED_ID,
                update_id=3,
            ),
        )

        async with session_module.session_scope() as s:
            review = await s.scalar(select(DailyReview))
            assert review.mood == 4

    async def test_review_offers_four_moods(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=2))

        send = next(c for c in recorder.calls if type(c).__name__ == "SendMessage")
        moods = [b.text for b in send.reply_markup.inline_keyboard[-1]]
        assert moods == ["😞", "😐", "🙂", "😄"]


class TestQuickNote:
    async def test_note_button_then_text_saves_the_summary(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)

        await dispatcher.feed_update(
            bot, callback_update(DayCB(action="note").pack(), ALLOWED_ID, update_id=2)
        )
        await dispatcher.feed_update(
            bot, text_update("يوم منتج، خلّصت أهم مهمتين", ALLOWED_ID, update_id=3)
        )

        async with session_module.session_scope() as s:
            note = await s.scalar(select(DailyNote))
            assert note.content == "يوم منتج، خلّصت أهم مهمتين"
            # ولم تُنشأ مهمة بالخطأ
            assert await s.scalar(select(Task)) is None

    async def test_note_appears_in_the_today_message(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/note", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(bot, text_update("ملخص النهارده", ALLOWED_ID, update_id=3))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=4))

        assert "ملخص النهارده" in recorder.sent_texts[0]

    async def test_note_appears_in_the_review(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/note", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(bot, text_update("كان يوم هادي", ALLOWED_ID, update_id=3))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/review", ALLOWED_ID, update_id=4))

        assert "كان يوم هادي" in recorder.sent_texts[0]

    async def test_rewriting_replaces_instead_of_appending(self, wired):
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        for i, text in enumerate(["الأول", "التاني"]):
            await dispatcher.feed_update(
                bot, text_update("/note", ALLOWED_ID, update_id=10 + i * 2)
            )
            await dispatcher.feed_update(
                bot, text_update(text, ALLOWED_ID, update_id=11 + i * 2)
            )

        async with session_module.session_scope() as s:
            notes = (await s.scalars(select(DailyNote))).all()
            assert len(notes) == 1
            assert notes[0].content == "التاني"


class TestReviewReminder:
    async def test_review_reminder_sends_the_review(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        day = date(2026, 8, 29)

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            schedule = await s.scalar(select(Schedule).where(Schedule.user_id == user.id))
            schedule.effective_from = day - timedelta(days=1)
            await s.flush()
            await scheduling.ensure_day(s, user, day, CAIRO)

        recorder.clear()
        async with session_module.session_scope() as s:
            # المراجعة تخصّ يوم 29 لكنها تقع فجر يوم 30
            await reminder_service.run_tick(
                bot, s, datetime(2026, 8, 30, 0, 5, tzinfo=CAIRO)
            )

        assert any("مراجعة" in t for t in recorder.sent_texts)
