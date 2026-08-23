"""يوم كامل من أوله لآخره — الاختبار الذي يثبت أن القطع تعمل معاً لا كلٌّ وحده."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from tracker.bot.keyboards import DayCB, HabitCB, ReviewCB, TaskCB
from tracker.db import session as session_module
from tracker.db.models import (
    DailyNote,
    DailyReview,
    Event,
    Habit,
    Schedule,
    TaskInstance,
    User,
    VocabEntry,
)
from tracker.services import reminders as reminder_service
from tracker.services import scheduling
from tracker.tests.fake_telegram import callback_update, text_update

ALLOWED_ID = 6493959847
CAIRO = ZoneInfo("Africa/Cairo")


async def _ids():
    async with session_module.session_scope() as s:
        user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
        habits = {
            h.name: h.id
            for h in (await s.scalars(select(Habit).where(Habit.user_id == user.id))).all()
        }
        return user.id, habits


async def _today() -> date:
    from tracker.config import get_settings
    from tracker.services.timeutil import logical_date, now_in

    return logical_date(now_in(get_settings().tz))


async def test_a_full_day_end_to_end(wired):
    dispatcher, bot, recorder = wired
    step = iter(range(1, 500))

    async def send(text: str):
        await dispatcher.feed_update(bot, text_update(text, ALLOWED_ID, update_id=next(step)))

    async def tap(data: str):
        await dispatcher.feed_update(bot, callback_update(data, ALLOWED_ID, update_id=next(step)))

    # ---------- الصباح: أول تشغيل ----------
    await send("/start")
    assert "أهلاً" in recorder.sent_texts[0]
    _, habits = await _ids()
    today = await _today()

    # ---------- إضافة مهام: واحدة متكررة وواحدة لمرة واحدة ----------
    await send("كل يوم مذاكرة 90 دقيقة 9م")
    await send("مشروع العميل")

    async with session_module.session_scope() as s:
        instances = (
            await s.scalars(
                select(TaskInstance).where(TaskInstance.occurrence_date == today)
            )
        ).all()
        assert len(instances) == 2
        first_id = min(i.id for i in instances)

    # ---------- إنجاز مهمة ----------
    await tap(TaskCB(action="toggle", instance_id=first_id).pack())
    async with session_module.session_scope() as s:
        assert (await s.get(TaskInstance, first_id)).is_done is True

    # ---------- تسجيل العادات ----------
    for _ in range(3):
        await tap(HabitCB(action="inc", habit_id=habits["شرب المياه"], step=1.0).pack())
    await tap(HabitCB(action="toggle", habit_id=habits["غسل الأسنان قبل النوم"]).pack())
    for _ in range(5):
        await tap(HabitCB(action="inc", habit_id=habits["قراءة في كتاب"], step=1.0).pack())

    # ---------- جملة إنجليزية للقاموس ----------
    await tap(HabitCB(action="vocab", habit_id=habits["حفظ جمل إنجليزية"]).pack())
    await send("Consistency beats intensity")

    async with session_module.session_scope() as s:
        entry = await s.scalar(select(VocabEntry))
        assert entry.content == "Consistency beats intensity"

    # ---------- حدث قادم ----------
    await tap(DayCB(action="add_event").pack())
    await send("اجتماع مع الفريق بكرة 10 ص")

    async with session_module.session_scope() as s:
        event = await s.scalar(select(Event))
        assert event.title == "اجتماع مع الفريق"

    # ---------- ملخص سريع ----------
    await tap(DayCB(action="note").pack())
    await send("يوم منتج، ناقص مشروع العميل")

    async with session_module.session_scope() as s:
        assert (await s.scalar(select(DailyNote))).content == "يوم منتج، ناقص مشروع العميل"

    # ---------- رسالة اليوم تجمع كل ما سبق ----------
    recorder.clear()
    await send("/today")
    body = recorder.sent_texts[0]
    assert "📋 <b>المهام</b> — 1 من 2" in body
    assert "⚡ <b>العادات</b> — 3 من 4" in body
    assert body.count("%") == 2          # رقمان منفصلان، بلا رقم مدموج
    assert "يوم منتج" in body
    assert "اجتماع مع الفريق" in body

    # ---------- تغيير موعد وسط اليوم ----------
    from tracker.bot.keyboards import ScheduleCB

    await tap(ScheduleCB(action="edit", slot="morning").pack())
    await send("8 ص")
    async with session_module.session_scope() as s:
        schedule = await s.scalar(
            select(Schedule).order_by(Schedule.effective_from.desc(), Schedule.id.desc())
        )
        assert schedule.morning_time == time(8, 0)

    # ---------- المراجعة الليلية ----------
    recorder.clear()
    await send("/review")
    review_text = recorder.sent_texts[0]
    assert "✅ مذاكرة 90 دقيقة" in review_text
    assert "⬜ مشروع العميل" in review_text
    assert "يوم منتج" in review_text
    assert "🔥" in review_text or "سلاسل" not in review_text

    # ---------- ترحيل غير المنجز ----------
    await tap(ReviewCB(action="carry", day=today.isoformat(), value=0).pack())
    async with session_module.session_scope() as s:
        tomorrow = (
            await s.scalars(
                select(TaskInstance).where(
                    TaskInstance.occurrence_date == today + timedelta(days=1)
                )
            )
        ).all()
        # المرحّلة فقط — المتكررة تظهر بنفسها ولا تُرحَّل
        assert len(tomorrow) == 1
        assert tomorrow[0].carried_from_date == today

    # ---------- تقييم المزاج ----------
    await tap(ReviewCB(action="mood", day=today.isoformat(), value=4).pack())
    async with session_module.session_scope() as s:
        assert (await s.scalar(select(DailyReview))).mood == 4

    # ---------- تقرير الأسبوع ----------
    recorder.clear()
    await send("/week")
    weekly = recorder.sent_texts[0]
    assert "ملخص الأسبوع" in weekly
    assert "Consistency beats intensity" in weekly
    assert "ترتيب العادات" in weekly

    # ---------- التصدير ----------
    recorder.clear()
    await send("/export")
    docs = [c for c in recorder.calls if type(c).__name__ == "SendDocument"]
    assert any(d.document.filename.endswith(".json") for d in docs)

    # ---------- الغد: المتكررة تظهر، والمرحّلة معها ----------
    async with session_module.session_scope() as s:
        user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
        pairs = await __import__(
            "tracker.services.tasks", fromlist=["day_pairs"]
        ).day_pairs(s, user, today + timedelta(days=1))
        titles = sorted(t.title for t, _ in pairs)
        assert titles == ["مذاكرة 90 دقيقة", "مشروع العميل"]


async def test_reminders_survive_a_restart(wired):
    """الطابور في القاعدة لا في الذاكرة — موزّع جديد يجد التذكيرات كما هي."""
    dispatcher, bot, recorder = wired
    day = date(2026, 8, 29)

    await dispatcher.feed_update(bot, text_update("/start", ALLOWED_ID, update_id=1))
    async with session_module.session_scope() as s:
        user = await s.scalar(select(User).where(User.telegram_id == ALLOWED_ID))
        schedule = await s.scalar(select(Schedule).where(Schedule.user_id == user.id))
        schedule.effective_from = day - timedelta(days=1)
        await s.flush()
        await scheduling.ensure_day(s, user, day, CAIRO)

    # موزّع جديد تماماً، كأن الخدمة أُعيد نشرها
    from tracker.bot.setup import build_dispatcher
    from tracker.tests.fake_telegram import make_bot

    fresh_bot, fresh_recorder = make_bot()
    build_dispatcher()

    async with session_module.session_scope() as s:
        result = await reminder_service.run_tick(
            fresh_bot, s, datetime(2026, 8, 29, 11, 5, tzinfo=CAIRO)
        )

    assert result.sent == 1
    assert any("صباح الخير" in t for t in fresh_recorder.sent_texts)
