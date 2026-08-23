"""بناء نصوص الرسائل. دوال خالصة بلا قاعدة بيانات ولا شبكة — سهلة الاختبار."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from tracker.db.models import Habit, HabitKind, HabitLog, Task, TaskInstance
from tracker.services.timeutil import (
    ARABIC_MONTHS,
    ARABIC_WEEKDAYS,
    format_arabic_date,
    format_time,
)

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
    event_lines: list[str] | None = None,
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

    if event_lines:
        lines += ["", "📅 <b>الأحداث القادمة</b>"] + event_lines

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


def render_review(summary) -> str:
    """رسالة المراجعة الليلية — الرقمان منفصلان هنا أيضاً."""
    lines = [
        f"🌙 <b>مراجعة {format_arabic_date(summary.day)}</b>",
        "",
        f"📋 <b>المهام</b> — {summary.task_done} من {summary.task_total}",
    ]

    if summary.task_total:
        lines.append(progress_line(summary.tasks_pct))
        lines += [f"✅ {title}" for title in summary.done_titles[:6]]
        lines += [f"⬜ {title}" for title in summary.missed_titles[:6]]
    else:
        lines.append("<i>لم تكن هناك مهام اليوم.</i>")

    if summary.habit_total:
        chips = " · ".join(
            habit_label(habit, log) for habit, log in summary.habit_state
        )
        lines += [
            "",
            f"⚡ <b>العادات</b> — {summary.habit_done} من {summary.habit_total}",
            progress_line(summary.habits_pct),
            chips,
        ]

    if summary.streaks:
        streaks = " · ".join(
            f"{habit.emoji} {count} أيام" for habit, count in summary.streaks
        )
        lines += ["", f"🔥 <b>سلاسل</b>: {streaks}"]

    if summary.note:
        lines += ["", "📝 <b>ملخص اليوم</b>", summary.note]

    if summary.carryable:
        word = "مهمة" if summary.carryable == 1 else "مهام"
        lines += ["", f"عندك {summary.carryable} {word} مش خالصة."]

    return "\n".join(lines)


def render_note_saved(content: str) -> str:
    return f"📝 اتسجّل ملخص اليوم:\n<i>{content}</i>"


def _range_label(start: date, end: date) -> str:
    if start.month == end.month:
        return f"{start.day} – {end.day} {ARABIC_MONTHS[start.month]} {start.year}"
    return (
        f"{start.day} {ARABIC_MONTHS[start.month]} – "
        f"{end.day} {ARABIC_MONTHS[end.month]} {end.year}"
    )


def render_period(
    progress,
    *,
    title: str,
    tasks_note: str | None = None,
    habits_note: str | None = None,
    sentences: list[str] | None = None,
) -> str:
    """تقرير فترة (أسبوع أو شهر) — رقمان منفصلان وأشرطة لكل عادة."""
    lines = [
        f"{title}",
        f"<i>{_range_label(progress.start, progress.end)}</i>",
    ]

    if progress.is_empty:
        lines += ["", "لا توجد بيانات في هذه الفترة بعد."]
        return "\n".join(lines)

    lines += [
        "",
        f"📋 <b>المهام</b> — {progress.tasks_done} من {progress.tasks_total}",
        progress_line(progress.tasks_pct),
    ]
    if tasks_note:
        lines.append(f"<i>{tasks_note}</i>")

    lines += [
        "",
        f"⚡ <b>العادات</b> — {progress.habits_done} من {progress.habits_total} يوم",
        progress_line(progress.habits_pct),
    ]
    if habits_note:
        lines.append(f"<i>{habits_note}</i>")

    if progress.habit_stats:
        lines += ["", "🏅 <b>ترتيب العادات</b>"]
        for stat in progress.habit_stats:
            row = (
                f"{stat.habit.emoji} <code>{progress_bar(stat.pct, 8)}</code> "
                f"{stat.pct:.0f}% · {stat.done_days}/{stat.active_days}"
            )
            if stat.stretch_days:
                row += f" · ⭐{stat.stretch_days}"
            lines.append(row)

        best = max(progress.habit_stats, key=lambda s: s.best_streak)
        if best.best_streak >= 2:
            lines += ["", f"🔥 أطول سلسلة حالية: {best.habit.emoji} {best.best_streak} أيام"]

    if sentences:
        lines += ["", f"📖 <b>جمل الأسبوع</b> ({len(sentences)})"]
        lines += [f"• {s}" for s in sentences[:15]]
        if len(sentences) > 15:
            lines.append(f"<i>و{len(sentences) - 15} غيرها في /dict</i>")

    return "\n".join(lines)


def render_events(events, today: date) -> list[str]:
    """أسطر الأحداث القادمة، بتسمية نسبية لليوم والغد."""
    lines: list[str] = []
    for event in events:
        if event.event_date == today:
            when = "النهاردة"
        elif event.event_date == today + timedelta(days=1):
            when = "بكرة"
        else:
            when = f"{ARABIC_WEEKDAYS[event.event_date.weekday()]} {event.event_date.day}"

        at = f" {format_time(event.event_time)}" if event.event_time else ""
        lines.append(f"• {when}{at} — {event.title}")
    return lines


def render_event_added(title: str, when: date, at: time | None, lead: int) -> str:
    body = [f"📅 اتسجّل: <b>{title}</b>", format_arabic_date(when)]
    if at is not None:
        body.append(f"⏰ {format_time(at)} · تذكير قبلها بـ{lead} دقيقة")
    else:
        body.append("<i>بلا وقت محدد — مفيش تذكير.</i>")
    return "\n".join(body)


def render_event_reminder(title: str, at: time | None, minutes: int) -> str:
    head = f"⏰ <b>{title}</b>"
    if at is not None:
        return f"{head}\nبعد {minutes} دقيقة — الساعة {format_time(at)}"
    return head
