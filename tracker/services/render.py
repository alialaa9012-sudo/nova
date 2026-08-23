"""بناء نصوص الرسائل. دوال خالصة بلا قاعدة بيانات ولا شبكة — سهلة الاختبار."""

from __future__ import annotations

from datetime import date, datetime, time

from tracker.db.models import Habit, HabitKind, HabitLog, Task, TaskInstance
from tracker.services.timeutil import format_arabic_date, format_time

FILLED = "█"
EMPTY = "░"
BAR_WIDTH = 10

EXCELLENT, GOOD, FAIR = 80.0, 60.0, 40.0


def progress_bar(pct: float, width: int = BAR_WIDTH) -> str:
    """شريط تقدّم نصي: ███████░░░"""
    pct = max(0.0, min(100.0, pct))
    filled = round(pct / 100 * width)
    return FILLED * filled + EMPTY * (width - filled)


def rating(pct: float) -> str:
    """التقييم النصي — يُطبَّق على كل رقم وحده، فلا يوجد رقم مدموج."""
    if pct >= EXCELLENT:
        return "ممتاز"
    if pct >= GOOD:
        return "جيد"
    if pct >= FAIR:
        return "متوسط"
    return "ضعيف"


def progress_line(pct: float) -> str:
    return f"<code>{progress_bar(pct)}</code> {pct:.0f}% · {rating(pct)}"


def format_value(value: float) -> str:
    """1.0 ← «1» و1.5 ← «1.5» — لا أصفار عشرية بلا داعٍ."""
    return f"{value:g}"


def habit_label(habit: Habit, log: HabitLog | None, *, max_len: int = 18) -> str:
    """نص زر العادة: الإيموجي، ثم الحالة أو القيمة مقابل الهدف."""
    value = log.value if log else 0.0
    done = bool(log and log.is_done)

    if habit.kind is HabitKind.BOOLEAN:
        return f"{habit.emoji} {'✅' if done else '⬜'}"

    mark = "⭐" if (log and log.is_stretch) else ("✅" if done else "")
    body = f"{format_value(value)}/{format_value(habit.target_value)}"
    return f"{habit.emoji} {body}{(' ' + mark) if mark else ''}"


def greeting(now: datetime) -> str:
    if now.hour < 12:
        return "صباح الخير"
    if now.hour < 18:
        return "مساء الخير"
    return "مساء الخير"


def task_label(task: Task, instance: TaskInstance, *, max_len: int = 34) -> str:
    """نص زر المهمة: مربّع الحالة، ثم الوقت إن وُجد، ثم العنوان."""
    box = "✅" if instance.is_done else "⬜"
    title = task.title
    if len(title) > max_len:
        title = title[: max_len - 1].rstrip() + "…"
    if task.scheduled_time is not None:
        return f"{box} {format_time(task.scheduled_time)} · {title}"
    return f"{box} {title}"


def render_today(
    *,
    name: str,
    now: datetime,
    day: date,
    task_done: int,
    task_total: int,
    tasks_pct: float,
    habit_done: int = 0,
    habit_total: int = 0,
    habits_pct: float = 0.0,
    carried_count: int = 0,
    note: str | None = None,
) -> str:
    """نص رسالة اليوم.

    التقدّم يُعرض كرقمين منفصلين — المهام والعادات — ولا يُدمجان في نسبة
    واحدة في أي مكان، كما طُلب في مرحلة الاكتشاف.
    """
    lines = [
        f"<b>{greeting(now)}، {name}</b> 👋",
        format_arabic_date(day),
    ]

    if task_total:
        lines += [
            "",
            f"📋 <b>المهام</b> — {task_done} من {task_total}",
            progress_line(tasks_pct),
        ]
        if carried_count:
            word = "مهمة مرحّلة" if carried_count == 1 else "مهام مرحّلة"
            lines.append(f"↩️ {carried_count} {word} من أمس")
    else:
        lines += ["", "📋 <b>المهام</b>", "لا توجد مهام بعد — اكتب أول مهمة."]

    if habit_total:
        lines += [
            "",
            f"⚡ <b>العادات</b> — {habit_done} من {habit_total}",
            progress_line(habits_pct),
        ]

    if note:
        lines += ["", "📝 <b>ملخص سريع</b>", note]

    if task_total and task_done == task_total and habit_done == habit_total and habit_total:
        lines += ["", "🎉 يوم كامل. أحسنت يا بطل!"]
    elif task_total and task_done == task_total:
        lines += ["", "🎉 خلّصت كل مهام اليوم."]

    return "\n".join(lines)


def render_task_added(title: str, at: time | None, recurrence_note: str | None) -> str:
    parts = [f"✅ تمت إضافة: <b>{title}</b>"]
    details = []
    if at is not None:
        details.append(format_time(at))
    if recurrence_note:
        details.append(recurrence_note)
    if details:
        parts.append(" · ".join(details))
    return "\n".join(parts)


def render_midday(pending_tasks: list[str], pending_habits: list[str]) -> str:
    """تذكير منتصف اليوم: الناقص فقط، بلا تكرار لما أُنجز."""
    lines = ["⏰ <b>باقي معاك</b>"]

    if pending_tasks:
        lines.append("")
        lines.append("📋 <b>مهام</b>")
        lines += [f"• {title}" for title in pending_tasks[:8]]
        if len(pending_tasks) > 8:
            lines.append(f"<i>و{len(pending_tasks) - 8} غيرها</i>")

    if pending_habits:
        lines.append("")
        lines.append("⚡ <b>عادات</b>")
        lines += [f"• {name}" for name in pending_habits]

    lines += ["", "افتح /today وخلّصها."]
    return "\n".join(lines)


def render_schedule(morning: time, midday: time | None, review: time) -> str:
    """عرض المواعيد الحالية."""
    lines = [
        "🕰 <b>مواعيدك الحالية</b>",
        "",
        f"☀️ رسالة اليوم — <b>{format_time(morning)}</b>",
        f"⏰ تذكير بالناقص — <b>{format_time(midday)}</b>"
        if midday
        else "⏰ تذكير بالناقص — <b>متوقّف</b>",
        f"🌙 المراجعة الليلية — <b>{format_time(review)}</b>",
    ]
    return "\n".join(lines)
