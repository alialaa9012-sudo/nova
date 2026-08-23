"""اختبارات وضع الإجازة، التصدير، ومعالجة الأخطاء."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from tracker.db import session as session_module
from tracker.db.models import Habit, Reminder, Schedule, User
from tracker.services import habits as habit_service
from tracker.services import scheduling
from tracker.tests.fake_telegram import text_update

ALLOWED_ID = 6493959847
CAIRO = ZoneInfo("Africa/Cairo")


async def _seed(dispatcher, bot):
    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))


async def _current_day() -> date:
    from tracker.config import get_settings
    from tracker.services.timeutil import logical_date, now_in

    return logical_date(now_in(get_settings().tz))


class TestPauseResume:
    async def test_pause_clears_pending_reminders(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        today = await _current_day()

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            await scheduling.ensure_horizon(s, user, today, CAIRO)

        await dispatcher.feed_update(bot, text_update("/pause", ALLOWED_ID, update_id=2))

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            assert user.is_paused is True
            pending = await s.scalar(
                select(func.count())
                .select_from(Reminder)
                .where(Reminder.is_sent.is_(False))
            )
            assert pending == 0

    async def test_pause_says_the_bot_still_works(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/pause", ALLOWED_ID, update_id=2))

        assert "/today" in recorder.sent_texts[0]

    async def test_pausing_twice_is_explained_not_repeated(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/pause", ALLOWED_ID, update_id=2))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/pause", ALLOWED_ID, update_id=3))

        assert "متوقّفة أصلاً" in recorder.sent_texts[0]

    async def test_resume_rebuilds_the_horizon(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/pause", ALLOWED_ID, update_id=2))
        await dispatcher.feed_update(bot, text_update("/resume", ALLOWED_ID, update_id=3))

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            assert user.is_paused is False
            pending = await s.scalar(
                select(func.count())
                .select_from(Reminder)
                .where(Reminder.is_sent.is_(False))
            )
            assert pending > 0

    async def test_today_still_works_while_paused(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("/pause", ALLOWED_ID, update_id=2))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=3))

        assert any("صباح" in t or "مساء" in t for t in recorder.sent_texts)


class TestExport:
    async def test_export_sends_a_json_document(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة للتصدير", ALLOWED_ID, update_id=2))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/export", ALLOWED_ID, update_id=3))

        docs = [c for c in recorder.calls if type(c).__name__ == "SendDocument"]
        assert docs
        json_doc = next(d for d in docs if d.document.filename.endswith(".json"))
        payload = json.loads(json_doc.document.data.decode("utf-8"))
        assert payload["tasks"][0]["title"] == "مهمة للتصدير"

    async def test_export_summary_counts_rows(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/export", ALLOWED_ID, update_id=2))

        summary = recorder.sent_texts[0]
        assert "نسخة من بياناتك" in summary
        assert "العادات: 4" in summary

    async def test_export_includes_csv_for_logged_habits(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        today = await _current_day()

        async with session_module.session_scope() as s:
            user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
            water = await s.scalar(select(Habit).where(Habit.name == "شرب المياه"))
            await habit_service.record(s, user, water.id, day=today, delta=3.0)

        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/export", ALLOWED_ID, update_id=2))

        docs = [c for c in recorder.calls if type(c).__name__ == "SendDocument"]
        names = [d.document.filename for d in docs]
        assert any(n.startswith("habit_logs") for n in names)

    async def test_csv_starts_with_a_bom_for_excel(self, wired):
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)
        await dispatcher.feed_update(bot, text_update("مهمة", ALLOWED_ID, update_id=2))
        recorder.clear()
        await dispatcher.feed_update(bot, text_update("/export", ALLOWED_ID, update_id=3))

        docs = [c for c in recorder.calls if type(c).__name__ == "SendDocument"]
        csv_doc = next(d for d in docs if d.document.filename.endswith(".csv"))
        assert csv_doc.document.data.startswith("﻿".encode("utf-8"))


class TestErrorHandling:
    async def test_a_handler_error_is_reported_not_swallowed_silently(self, wired, monkeypatch):
        """خطأ في معالج يجب ألا يُسقط الـwebhook — وإلا أعاد تليجرام المحاولة بلا نهاية."""
        dispatcher, bot, recorder = wired
        await _seed(dispatcher, bot)

        from tracker.services import tasks as task_service

        def boom(*args, **kwargs):
            raise RuntimeError("انفجار مقصود للاختبار")

        monkeypatch.setattr(task_service, "day_pairs", boom)
        recorder.clear()

        # لا يُرفع الاستثناء إلى الخارج
        await dispatcher.feed_update(bot, text_update("/today", ALLOWED_ID, update_id=2))

        assert any("حصل خطأ" in t for t in recorder.sent_texts)


class TestExportSerialization:
    """أعمدة الوقت كسرت التصدير مرة — هذا الاختبار يمنع رجوعها."""

    def test_time_columns_serialize(self):
        from datetime import time as t

        from tracker.services.export import _plain, to_json

        assert _plain(t(11, 0)) == "11:00:00"
        payload = to_json({"schedules": [{"morning_time": t(11, 0)}]})
        assert b"11:00:00" in payload

    def test_enum_columns_serialize(self):
        from tracker.db.models import Recurrence
        from tracker.services.export import _plain

        assert _plain(Recurrence.DAILY) == "daily"

    def test_none_passes_through(self):
        from tracker.services.export import _plain

        assert _plain(None) is None
