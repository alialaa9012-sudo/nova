"""اختبار تكامل: تحديث تليجرام حقيقي يمرّ خلال الموزّع كاملاً — بلا شبكة."""

from __future__ import annotations

from tracker.db import session as session_module
from tracker.tests.fake_telegram import text_update

ALLOWED_ID = 6493959847
STRANGER_ID = 111222333


async def test_start_greets_the_owner(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID))

    assert len(recorder.sent_texts) == 1
    reply = recorder.sent_texts[0]
    assert "أهلاً" in reply
    assert "Ali" in reply


async def test_first_start_shows_default_schedule(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID))

    reply = recorder.sent_texts[0]
    assert "11:00 ص" in reply   # رسالة اليوم
    assert "3:00 م" in reply    # تذكير بالناقص
    assert "12:00 ص" in reply   # المراجعة الليلية
    assert "/times" in reply


async def test_stranger_is_ignored_completely(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("/start", STRANGER_ID))

    # لا ردّ ولا حتى محاولة إرسال — الصمت التام هو السلوك المقصود.
    assert recorder.calls == []


async def test_second_start_skips_onboarding(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))
    recorder.clear()
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=2))

    reply = recorder.sent_texts[0]
    assert "أهلاً" in reply
    assert "مواعيدك المبدئية" not in reply


async def test_help_lists_commands(wired):
    dispatcher, bot, recorder = wired
    await dispatcher.feed_update(bot, text_update("/help", ALLOWED_ID))

    reply = recorder.sent_texts[0]
    for command in ("/today", "/times", "/dict", "/week", "/month", "/pause", "/export"):
        assert command in reply


async def test_user_and_habits_persist_after_start(wired):
    dispatcher, bot, _ = wired
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID))

    from sqlalchemy import func, select

    from tracker.db.models import Habit, User

    async with session_module.session_scope() as s:
        user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
        assert user is not None
        count = await s.scalar(
            select(func.count()).select_from(Habit).where(Habit.user_id == user.id)
        )
        assert count == 4
