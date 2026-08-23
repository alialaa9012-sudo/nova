"""بناء نصوص الرسائل. دوال خالصة بلا قاعدة بيانات ولا شبكة — سهلة الاختبار."""

from __future__ import annotations

from datetime import date, datetime, time

from tracker.db.models import Task, TaskInstance
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


def progress_line(label: str, pct: float) -> str:
    return f"<code>{progress_bar(pct)}</code> {pct:.0f}% — {label} {rating(pct)}"


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
    carried_count: int = 0,
) -> str:
    """نص رسالة اليوم. المهام نفسها تظهر كأزرار تحت هذا النص."""
    lines = [
        f"<b>{greeting(now)}، {name}</b> 👋",
        format_arabic_date(day),
        "",
    ]

    if task_total == 0:
        lines += [
            "📋 <b>مهام اليوم</b>",
            "لا توجد مهام بعد — أضف أول مهمة وابدأ يومك.",
        ]
        return "\n".join(lines)

    lines += [
        f"📋 <b>مهام اليوم</b> — {task_done} من {task_total}",
        progress_line("المهام", tasks_pct),
    ]

    if carried_count:
        word = "مهمة مرحّلة" if carried_count == 1 else "مهام مرحّلة"
        lines += ["", f"↩️ {carried_count} {word} من أمس"]

    if task_done == task_total:
        lines += ["", "🎉 خلّصت كل مهام اليوم. أحسنت!"]

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
