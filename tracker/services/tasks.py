"""منطق المهام: أي مهمة تظهر اليوم، وكيف تُنجَز، وكيف تُرحَّل.

القوالب في ``Task`` والظهور الفعلي في ``TaskInstance``. توليد نسخة اليوم
عملية idempotent: تُستدعى كلما فُتحت رسالة اليوم بلا تكرار ولا فقدان حالة.
"""

from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import Recurrence, Task, TaskInstance, User


def occurs_on(task: Task, day: date) -> bool:
    """هل يجب أن تظهر هذه المهمة في هذا اليوم؟"""
    if not task.is_active:
        return False

    if task.recurrence is Recurrence.DAILY:
        return True

    if task.recurrence is Recurrence.CUSTOM_DAYS:
        return bool(task.custom_days) and day.weekday() in task.custom_days

    if task.recurrence is Recurrence.WEEKLY:
        # تتكرر في نفس يوم الأسبوع الذي حُدّد لها عند الإنشاء
        anchor = task.due_date or task.created_at.date()
        return day.weekday() == anchor.weekday()

    # Recurrence.NONE — تظهر في تاريخها وحده
    return task.due_date == day


async def materialize_day(
    session: AsyncSession, user: User, day: date
) -> list[TaskInstance]:
    """يضمن وجود نسخة لكل مهمة تخصّ هذا اليوم، ويعيدها مرتّبة.

    الترتيب: المهام الموقوتة أولاً حسب وقتها، ثم غير الموقوتة حسب ترتيبها اليدوي.
    """
    templates = (
        await session.scalars(
            select(Task).where(Task.user_id == user.id, Task.is_active.is_(True))
        )
    ).all()

    existing = {
        inst.task_id: inst
        for inst in (
            await session.scalars(
                select(TaskInstance).where(
                    TaskInstance.user_id == user.id,
                    TaskInstance.occurrence_date == day,
                )
            )
        ).all()
    }

    due_today = [t for t in templates if occurs_on(t, day)]
    for template in due_today:
        if template.id not in existing:
            instance = TaskInstance(
                task_id=template.id, user_id=user.id, occurrence_date=day
            )
            session.add(instance)
            existing[template.id] = instance

    await session.flush()

    pairs = [(t, existing[t.id]) for t in due_today if t.id in existing]
    # نسخة اليوم المُرحَّلة من أمس تظل ظاهرة حتى لو انتهى تاريخ قالبها
    for inst in existing.values():
        if inst.carried_from_date and all(inst.id != p[1].id for p in pairs):
            template = await session.get(Task, inst.task_id)
            if template is not None:
                pairs.append((template, inst))

    pairs.sort(key=_sort_key)
    return [inst for _, inst in pairs]


def _sort_key(pair: tuple[Task, TaskInstance]) -> tuple[int, time, int, int]:
    task, _ = pair
    if task.scheduled_time is not None:
        return (0, task.scheduled_time, task.sort_order, task.id)
    return (1, time(0, 0), task.sort_order, task.id)


async def day_pairs(
    session: AsyncSession, user: User, day: date
) -> list[tuple[Task, TaskInstance]]:
    """المهام مع نسخها لهذا اليوم، مرتّبة كما تُعرض."""
    instances = await materialize_day(session, user, day)
    by_id = {i.id: i for i in instances}
    tasks = (
        await session.scalars(
            select(Task).where(Task.id.in_([i.task_id for i in instances]))
        )
    ).all() if instances else []
    lookup = {t.id: t for t in tasks}

    pairs = [(lookup[i.task_id], i) for i in by_id.values() if i.task_id in lookup]
    pairs.sort(key=_sort_key)
    return pairs


async def toggle(
    session: AsyncSession, user: User, instance_id: int, *, tz: ZoneInfo
) -> TaskInstance | None:
    """يقلب حالة الإنجاز. يعيد None إذا لم تكن النسخة للمستخدم نفسه."""
    instance = await session.get(TaskInstance, instance_id)
    if instance is None or instance.user_id != user.id:
        return None

    instance.is_done = not instance.is_done
    instance.done_at = datetime.now(tz) if instance.is_done else None
    await session.flush()
    return instance


async def add_task(
    session: AsyncSession,
    user: User,
    title: str,
    *,
    day: date,
    scheduled_time: time | None = None,
    recurrence: Recurrence = Recurrence.NONE,
    custom_days: list[int] | None = None,
) -> tuple[Task, TaskInstance | None]:
    """ينشئ قالب مهمة، وينشئ نسخة اليوم فوراً إن كانت تخصّ اليوم."""
    last_order = await session.scalar(
        select(Task.sort_order)
        .where(Task.user_id == user.id)
        .order_by(Task.sort_order.desc())
        .limit(1)
    )

    task = Task(
        user_id=user.id,
        title=title.strip(),
        scheduled_time=scheduled_time,
        recurrence=recurrence,
        custom_days=custom_days,
        due_date=day if recurrence in (Recurrence.NONE, Recurrence.WEEKLY) else None,
        sort_order=(last_order or 0) + 1,
    )
    session.add(task)
    await session.flush()

    instance = None
    if occurs_on(task, day):
        instance = TaskInstance(task_id=task.id, user_id=user.id, occurrence_date=day)
        session.add(instance)
        await session.flush()

    return task, instance


async def carry_unfinished(
    session: AsyncSession, user: User, *, from_day: date, to_day: date
) -> list[TaskInstance]:
    """يرحّل مهام يومٍ غير المنجزة إلى اليوم التالي.

    المهام المتكررة لا تُرحَّل — ستظهر بنفسها غداً، والترحيل يُنشئ ازدواجاً.
    """
    pairs = await day_pairs(session, user, from_day)
    carried: list[TaskInstance] = []

    for task, instance in pairs:
        if instance.is_done or task.recurrence is not Recurrence.NONE:
            continue

        already = await session.scalar(
            select(TaskInstance).where(
                TaskInstance.task_id == task.id,
                TaskInstance.occurrence_date == to_day,
            )
        )
        if already is not None:
            continue

        task.due_date = to_day
        moved = TaskInstance(
            task_id=task.id,
            user_id=user.id,
            occurrence_date=to_day,
            carried_from_date=from_day,
        )
        session.add(moved)
        carried.append(moved)

    await session.flush()
    return carried


def completion(pairs: list[tuple[Task, TaskInstance]]) -> tuple[int, int, float]:
    """(المنجز، الإجمالي، النسبة المئوية). يوم بلا مهام = 0%."""
    total = len(pairs)
    done = sum(1 for _, inst in pairs if inst.is_done)
    pct = (done / total * 100) if total else 0.0
    return done, total, pct
