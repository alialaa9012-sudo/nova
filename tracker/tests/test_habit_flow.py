"""اختبار تكامل للعادات: التسجيل بضغطة، وحفظ الجمل الإنجليزية."""

from __future__ import annotations

from sqlalchemy import select

from tracker.bot.keyboards import HabitCB
from tracker.db import session as session_module
from tracker.db.models import Habit, HabitLog, Task, User, VocabEntry
from tracker.tests.fake_telegram import callback_update, text_update

ALLOWED_ID = 6493959847


async def _habit_id(name: str) -> int:
    async with session_module.session_scope() as s:
        return await s.scalar(select(Habit.id).where(Habit.name == name))


async def _seed(dispatcher, bot):
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))


async def _last_keyboard(recorder):
    call = next(
        c
        for c in reversed(recorder.calls)
        if type(c).__name__ in {"SendMessage", "EditMessageText"} and c.reply_markup
    )
    return call.reply_markup.inline_keyboard


class TestKeyboardLayout:
    async def test_today_shows_a_row_per_habit(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=2))

        rows = await _last_keyboard(recorder)
        labels = [r[0].text for r in rows]
        assert "💧 0/3" in labels
        assert "🪥 ⬜" in labels
        assert "📖 0/2" in labels
        assert "🗣️ 0/5" in labels

    async def test_counter_rows_carry_quick_steps(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=2))

        rows = await _last_keyboard(recorder)
        water_row = next(r for r in rows if r[0].text.startswith("💧"))
        assert [b.text for b in water_row[1:]] == ["+0.25", "+0.5"]

    async def test_boolean_row_is_a_single_button(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=2))

        rows = await _last_keyboard(recorder)
        teeth_row = next(r for r in rows if r[0].text.startswith("🪥"))
        assert len(teeth_row) == 1

    async def test_vocab_row_offers_a_write_button(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=2))

        rows = await _last_keyboard(recorder)
        vocab_row = next(r for r in rows if r[0].text.startswith("🗣️"))
        assert vocab_row[1].text == "✍️ اكتب"


class TestTapping:
    async def test_boolean_habit_toggles_in_place(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        teeth = await _habit_id("غسل الأسنان قبل النوم")
        recorder.clear()

        await dispatcher.feed_update(
            bot,
            callback_update(
                HabitCB(action="toggle", habit_id=teeth).pack(), ALLOWED_ID, update_id=2
            ),
        )

        async with session_module.session_scope() as s:
            log = await s.scalar(select(HabitLog).where(HabitLog.habit_id == teeth))
            assert log.is_done is True

        assert "EditMessageText" in [type(c).__name__ for c in recorder.calls]

    async def test_water_increments_by_the_tapped_step(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        water = await _habit_id("شرب المياه")

        for i in range(3):
            await dispatcher.feed_update(
                bot,
                callback_update(
                    HabitCB(action="inc", habit_id=water, step=0.5).pack(),
                    ALLOWED_ID,
                    update_id=10 + i,
                ),
            )

        async with session_module.session_scope() as s:
            log = await s.scalar(select(HabitLog).where(HabitLog.habit_id == water))
            assert log.value == 1.5
            assert log.is_done is False

    async def test_reading_two_pages_is_done_five_is_stretch(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        reading = await _habit_id("قراءة في كتاب")
        payload = HabitCB(action="inc", habit_id=reading, step=1.0).pack()

        for i in range(2):
            await dispatcher.feed_update(bot, callback_update(payload, ALLOWED_ID, update_id=20 + i))

        async with session_module.session_scope() as s:
            log = await s.scalar(select(HabitLog).where(HabitLog.habit_id == reading))
            assert (log.is_done, log.is_stretch) == (True, False)

        for i in range(3):
            await dispatcher.feed_update(bot, callback_update(payload, ALLOWED_ID, update_id=30 + i))

        async with session_module.session_scope() as s:
            log = await s.scalar(select(HabitLog).where(HabitLog.habit_id == reading))
            assert (log.value, log.is_stretch) == (5.0, True)

    async def test_progress_shows_two_separate_numbers(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة واحدة", ALLOWED_ID, update_id=2))
        teeth = await _habit_id("غسل الأسنان قبل النوم")
        recorder.clear()

        await dispatcher.feed_update(
            bot,
            callback_update(
                HabitCB(action="toggle", habit_id=teeth).pack(), ALLOWED_ID, update_id=3
            ),
        )

        edited = next(c for c in recorder.calls if type(c).__name__ == "EditMessageText")
        assert "📋 <b>المهام</b> — 0 من 1" in edited.text
        assert "⚡ <b>العادات</b> — 1 من 4" in edited.text
        # لا يوجد رقم مدموج في أي مكان
        assert edited.text.count("%") == 2


class TestVocabularyCapture:
    async def test_write_button_then_text_saves_a_sentence(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        vocab = await _habit_id("حفظ جمل إنجليزية")

        await dispatcher.feed_update(
            bot,
            callback_update(
                HabitCB(action="vocab", habit_id=vocab).pack(), ALLOWED_ID, update_id=2
            ),
        )
        await dispatcher.feed_update(
            bot, text_update("The weather is lovely today", ALLOWED_ID, update_id=3)
        )

        async with session_module.session_scope() as s:
            entry = await s.scalar(select(VocabEntry))
            assert entry.content == "The weather is lovely today"
            # وأهم شيء: لم تُنشأ مهمة بالخطأ
            assert await s.scalar(select(Task)) is None
            log = await s.scalar(select(HabitLog).where(HabitLog.habit_id == vocab))
            assert log.value == 1.0

    async def test_pending_state_lives_in_the_database(self, wired):
        """الانتظار مخزّن في القاعدة لا في الذاكرة، فينجو من نوم الخدمة."""
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        vocab = await _habit_id("حفظ جمل إنجليزية")

        await dispatcher.feed_update(
            bot,
            callback_update(
                HabitCB(action="vocab", habit_id=vocab).pack(), ALLOWED_ID, update_id=2
            ),
        )

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            assert user.pending_action == "vocab"
            assert user.pending_ref == vocab

    async def test_pending_clears_after_one_sentence(self, wired):
        dispatcher, bot, _ = wired
        await _seed(dispatcher, bot)
        vocab = await _habit_id("حفظ جمل إنجليزية")

        await dispatcher.feed_update(
            bot,
            callback_update(
                HabitCB(action="vocab", habit_id=vocab).pack(), ALLOWED_ID, update_id=2
            ),
        )
        await dispatcher.feed_update(bot, text_update("First sentence", ALLOWED_ID, update_id=3))
        await dispatcher.feed_update(bot, text_update("شراء الخضار", ALLOWED_ID, update_id=4))

        async with session_module.session_scope() as s:
            # الجملة الأولى للقاموس، والثانية عادت مهمة كالمعتاد
            assert len((await s.scalars(select(VocabEntry))).all()) == 1
            task = await s.scalar(select(Task))
            assert task.title == "شراء الخضار"

    async def test_cancel_drops_the_pending_prompt(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        vocab = await _habit_id("حفظ جمل إنجليزية")

        await dispatcher.feed_update(
            bot,
            callback_update(
                HabitCB(action="vocab", habit_id=vocab).pack(), ALLOWED_ID, update_id=2
            ),
        )
        await dispatcher.feed_update(bot, text_update("/cancel", ALLOWED_ID, update_id=3))
        await dispatcher.feed_update(bot, text_update("مهمة عادية", ALLOWED_ID, update_id=4))

        async with session_module.session_scope() as s:
            assert await s.scalar(select(VocabEntry)) is None
            assert (await s.scalar(select(Task))).title == "مهمة عادية"


class TestDictionary:
    async def test_empty_dictionary_explains_how_to_start(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/dict", ALLOWED_ID, update_id=2))

        assert "قاموسك فاضي" in recorder.sent_texts[0]

    async def test_dictionary_lists_saved_sentences_by_day(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        vocab = await _habit_id("حفظ جمل إنجليزية")

        for i, sentence in enumerate(["I am learning", "She works hard"]):
            await dispatcher.feed_update(
                bot,
                callback_update(
                    HabitCB(action="vocab", habit_id=vocab).pack(),
                    ALLOWED_ID,
                    update_id=10 + i * 2,
                ),
            )
            await dispatcher.feed_update(
                bot, text_update(sentence, ALLOWED_ID, update_id=11 + i * 2)
            )

        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/dict", ALLOWED_ID, update_id=99))

        body = recorder.sent_texts[0]
        assert "I am learning" in body
        assert "She works hard" in body
        assert "هذا الأسبوع" in body
