"""تهيئة المستخدم لأول مرة: حسابه، مواعيده، وعاداته الأربع."""

from __future__ import annotations

from datetime import date, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import Habit, HabitKind, Schedule, User

DEFAULT_MORNING = time(11, 0)
DEFAULT_MIDDAY = time(15, 0)
DEFAULT_REVIEW = time(0, 0)

# العادات الأربع كما حدّدها المستخدم في مرحلة الاكتشاف.
DEFAULT_HABITS: list[dict] = [
    {
        "name": "شرب المياه",
        "emoji": "💧",
        "kind": HabitKind.COUNTER,
        "target_value": 3.0,
        "unit": "لتر",
        "quick_steps": [0.25, 0.5, 1.0],
        "sort_order": 0,
    },
    {
        "name": "غسل الأسنان قبل النوم",
        "emoji": "🪥",
        "kind": HabitKind.BOOLEAN,
        "target_value": 1.0,
        "sort_order": 1,
    },
    {
        "name": "قراءة في كتاب",
        "emoji": "📖",
        "kind": HabitKind.COUNTER,
        "target_value": 2.0,   # صفحتان = منجزة
        "stretch_value": 5.0,  # خمس صفحات = ممتاز
        "unit": "صفحة",
        "quick_steps": [1.0, 2.0],
        "sort_order": 2,
    },
    {
        "name": "حفظ جمل إنجليزية",
        "emoji": "🗣️",
        "kind": HabitKind.COUNTER,
        "target_value": 5.0,
        "unit": "جملة",
        "quick_steps": [1.0],
        "captures_text": True,  # يطلب كتابة الجملة ويحفظها في القاموس
        "sort_order": 3,
    },
]


async def get_or_create_user(
    session: AsyncSession,
    telegram_id: int,
    *,
    username: str | None = None,
    first_name: str | None = None,
    today: date | None = None,
) -> tuple[User, bool]:
    """يعيد المستخدم وينشئه بعاداته ومواعيده الافتراضية إن كان جديداً.

    القيمة الثانية ``True`` إذا أُنشئ الآن لأول مرة.
    """
    existing = await session.scalar(
        select(User).where(User.telegram_id == telegram_id)
    )
    if existing is not None:
        return existing, False

    user = User(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
    )
    session.add(user)
    await session.flush()

    session.add(
        Schedule(
            user_id=user.id,
            effective_from=today or date.today(),
            morning_time=DEFAULT_MORNING,
            midday_time=DEFAULT_MIDDAY,
            review_time=DEFAULT_REVIEW,
        )
    )
    for spec in DEFAULT_HABITS:
        session.add(Habit(user_id=user.id, **spec))

    await session.flush()
    return user, True


async def current_schedule(session: AsyncSession, user_id: int, on: date) -> Schedule | None:
    """جدول المواعيد السارِي في تاريخ معيّن — آخر جدول بدأ سريانه قبله أو فيه."""
    return await session.scalar(
        select(Schedule)
        .where(Schedule.user_id == user_id, Schedule.effective_from <= on)
        .order_by(Schedule.effective_from.desc(), Schedule.id.desc())
        .limit(1)
    )
