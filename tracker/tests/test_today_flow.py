"""اختبار تكامل لرسالة اليوم: إضافة مهمة، إنجازها، وتحديث الرسالة في مكانها."""

from __future__ import annotations

from sqlalchemy import select

from tracker.bot.keyboards import DayCB, TaskCB
from tracker.db import session as session_module
from tracker.db.models import Recurrence, Task, TaskInstance, User
from tracker.tests.fake_telegram import callback_update, text_update

ALLOWED_ID = 6493959847


async def _first_instance_id() -> int:
    async with session_module.session_scope() as s:
        return await s.scalar(select(TaskInstance.id).order_by(TaskInstance.id))


async def test_free_text_creates_a_task(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("قراءة 20 صفحة", ALLOWED_ID))

    async with session_module.session_scope() as s:
        task = await s.scalar(select(Task))
        assert task is not None
        assert task.title == "قراءة 20 صفحة"
        assert task.recurrence is Recurrence.NONE

    assert any("تمت إضافة" in t for t in recorder.sent_texts)


async def test_free_text_with_time_and_recurrence(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("كل سبت جيم 6م", ALLOWED_ID))

    async with session_module.session_scope() as s:
        task = await s.scalar(select(Task))
        assert task.title == "جيم"
        assert task.recurrence is Recurrence.CUSTOM_DAYS
        assert task.custom_days == [5]
        assert task.scheduled_time.hour == 18

    confirmation = next(t for t in recorder.sent_texts if "تمت إضافة" in t)
    assert "السبت" in confirmation
    assert "6:00 م" in confirmation


async def test_today_message_shows_task_count_and_bar(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("مهمة أولى", ALLOWED_ID, update_id=1))
    await dispatcher.feed_update(bot, text_update("مهمة تانية", ALLOWED_ID, update_id=2))
    recorder.clear()
    await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=3))

    body = recorder.sent_texts[0]
    assert "0 من 2" in body
    assert "0%" in body
    assert "ضعيف" in body


async def test_empty_day_shows_friendly_state(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID))

    assert "لا توجد مهام بعد" in recorder.sent_texts[0]


async def test_today_keyboard_has_one_button_per_task(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("مهمة أولى", ALLOWED_ID, update_id=1))
    recorder.clear()
    await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=2))

    send = next(c for c in recorder.calls if type(c).__name__ == "SendMessage")
    rows = send.reply_markup.inline_keyboard
    assert rows[0][0].text == "⬜ مهمة أولى"
    assert [b.text for b in rows[-1]] == ["➕ إضافة مهمة", "📝 ملخص", "🔄 تحديث"]


async def test_tapping_a_task_marks_it_done_and_edits_in_place(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("قراءة 20 صفحة", ALLOWED_ID, update_id=1))
    instance_id = await _first_instance_id()
    recorder.clear()

    await dispatcher.feed_update(
        bot,
        callback_update(
            TaskCB(action="toggle", instance_id=instance_id).pack(),
            ALLOWED_ID,
            update_id=2,
        ),
    )

    async with session_module.session_scope() as s:
        instance = await s.get(TaskInstance, instance_id)
        assert instance.is_done is True
        assert instance.done_at is not None

    # حُرّرت الرسالة نفسها ولم تُرسَل رسالة جديدة
    kinds = [type(c).__name__ for c in recorder.calls]
    assert "EditMessageText" in kinds
    assert "SendMessage" not in kinds

    edited = next(c for c in recorder.calls if type(c).__name__ == "EditMessageText")
    assert "1 من 1" in edited.text
    assert "🎉" in edited.text
    assert edited.reply_markup.inline_keyboard[0][0].text == "✅ قراءة 20 صفحة"


async def test_tapping_twice_returns_to_undone(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("قراءة", ALLOWED_ID, update_id=1))
    instance_id = await _first_instance_id()
    payload = TaskCB(action="toggle", instance_id=instance_id).pack()

    await dispatcher.feed_update(bot, callback_update(payload, ALLOWED_ID, update_id=2))
    await dispatcher.feed_update(bot, callback_update(payload, ALLOWED_ID, update_id=3))

    async with session_module.session_scope() as s:
        instance = await s.get(TaskInstance, instance_id)
        assert instance.is_done is False
        assert instance.done_at is None


async def test_add_task_button_shows_examples(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(
        bot, callback_update(DayCB(action="add_task").pack(), ALLOWED_ID)
    )

    hint = recorder.sent_texts[0]
    assert "كل سبت جيم 6م" in hint


async def test_today_message_id_is_remembered(wired):
    dispatcher, bot, _ = wired
    await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID))

    async with session_module.session_scope() as s:
        user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
        assert user.today_message_id is not None
        assert user.today_message_date is not None


async def test_stranger_cannot_toggle_owner_task(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("مهمة خاصة", ALLOWED_ID, update_id=1))
    instance_id = await _first_instance_id()
    recorder.clear()

    await dispatcher.feed_update(
        bot,
        callback_update(
            TaskCB(action="toggle", instance_id=instance_id).pack(),
            111222333,
            update_id=2,
        ),
    )

    assert recorder.calls == []
    async with session_module.session_scope() as s:
        assert (await s.get(TaskInstance, instance_id)).is_done is False
