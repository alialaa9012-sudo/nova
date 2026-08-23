"""تصدير كل بيانات المستخدم — بياناتك ملكك وتخرج معك في أي وقت."""

from __future__ import annotations

import csv
import io
import json
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import (
    DailyNote,
    DailyReview,
    Event,
    Habit,
    HabitLog,
    Schedule,
    Task,
    TaskInstance,
    User,
    VocabEntry,
)


def _plain(value: Any) -> Any:
    # datetime قبل date لأنها ترث منها؛ وtime نوع مستقل لا يرثها
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if hasattr(value, "value"):  # Enum
        return value.value
    return value


def _rows(objects: list[Any]) -> list[dict[str, Any]]:
    out = []
    for obj in objects:
        out.append(
            {
                column.name: _plain(getattr(obj, column.name))
                for column in obj.__table__.columns
            }
        )
    return out


async def collect(session: AsyncSession, user: User) -> dict[str, list[dict[str, Any]]]:
    """كل جداول المستخدم في بنية واحدة."""

    async def fetch(model, column):
        return list((await session.scalars(select(model).where(column == user.id))).all())

    return {
        "user": _rows([user]),
        "schedules": _rows(await fetch(Schedule, Schedule.user_id)),
        "tasks": _rows(await fetch(Task, Task.user_id)),
        "task_instances": _rows(await fetch(TaskInstance, TaskInstance.user_id)),
        "habits": _rows(await fetch(Habit, Habit.user_id)),
        "habit_logs": _rows(await fetch(HabitLog, HabitLog.user_id)),
        "vocab_entries": _rows(await fetch(VocabEntry, VocabEntry.user_id)),
        "events": _rows(await fetch(Event, Event.user_id)),
        "daily_notes": _rows(await fetch(DailyNote, DailyNote.user_id)),
        "daily_reviews": _rows(await fetch(DailyReview, DailyReview.user_id)),
    }


def to_json(data: dict[str, list[dict[str, Any]]]) -> bytes:
    """يُسلسل البيانات. ``default`` شبكة أمان لأي نوع لم يمرّ على ``_plain``."""
    return json.dumps(
        data, ensure_ascii=False, indent=2, default=_plain
    ).encode("utf-8")


def to_csv(rows: list[dict[str, Any]]) -> bytes:
    """جدول واحد كـCSV بترميز UTF-8 يفتحه إكسل بلا تشويش."""
    if not rows:
        return "﻿".encode("utf-8")

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    for row in rows:
        writer.writerow({k: _plain(v) for k, v in row.items()})
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def summarize(data: dict[str, list[dict[str, Any]]]) -> str:
    counts = {name: len(rows) for name, rows in data.items() if name != "user"}
    lines = ["📦 <b>نسخة من بياناتك</b>", ""]
    labels = {
        "tasks": "قوالب المهام",
        "task_instances": "أيام المهام",
        "habits": "العادات",
        "habit_logs": "سجلات العادات",
        "vocab_entries": "جمل القاموس",
        "events": "الأحداث",
        "daily_notes": "الملخصات",
        "daily_reviews": "المراجعات",
        "schedules": "جداول المواعيد",
    }
    for key, label in labels.items():
        lines.append(f"• {label}: {counts.get(key, 0)}")
    return "\n".join(lines)
