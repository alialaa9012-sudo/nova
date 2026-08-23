"""لوحات الأزرار وبيانات النداءات."""

from __future__ import annotations

from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from tracker.db.models import Habit, HabitKind, HabitLog, Task, TaskInstance
from tracker.services.render import format_value, habit_label, task_label


class TaskCB(CallbackData, prefix="t"):
    """نداء يخصّ مهمة بعينها."""

    action: str  # toggle
    instance_id: int


class HabitCB(CallbackData, prefix="h"):
    """نداء يخصّ عادة."""

    action: str  # inc | toggle | vocab
    habit_id: int
    step: float = 0.0


class DayCB(CallbackData, prefix="d"):
    """نداء يخصّ رسالة اليوم ككل."""

    action: str  # refresh | add_task


def _habit_row(habit: Habit, log: HabitLog | None) -> list[InlineKeyboardButton]:
    """صفّ العادة: زر الحالة، ثم أزرار التسجيل السريع بجواره.

    التسجيل بضغطة واحدة مقصود — أي شاشة وسيطة تضيف احتكاكاً يومياً.
    """
    if habit.kind is HabitKind.BOOLEAN:
        return [
            InlineKeyboardButton(
                text=habit_label(habit, log),
                callback_data=HabitCB(action="toggle", habit_id=habit.id).pack(),
            )
        ]

    row = [
        InlineKeyboardButton(
            text=habit_label(habit, log),
            callback_data=HabitCB(action="inc", habit_id=habit.id, step=0.0).pack(),
        )
    ]

    if habit.captures_text:
        row.append(
            InlineKeyboardButton(
                text="✍️ اكتب",
                callback_data=HabitCB(action="vocab", habit_id=habit.id).pack(),
            )
        )
        return row

    for step in (habit.quick_steps or [1.0])[:2]:
        row.append(
            InlineKeyboardButton(
                text=f"+{format_value(step)}",
                callback_data=HabitCB(action="inc", habit_id=habit.id, step=step).pack(),
            )
        )
    return row


def today_keyboard(
    pairs: list[tuple[Task, TaskInstance]],
    habit_state: list[tuple[Habit, HabitLog | None]] | None = None,
) -> InlineKeyboardMarkup:
    """زرّ لكل مهمة، وصفّ لكل عادة، وصفّ إجراءات في الأسفل."""
    builder = InlineKeyboardBuilder()

    for task, instance in pairs:
        builder.row(
            InlineKeyboardButton(
                text=task_label(task, instance),
                callback_data=TaskCB(action="toggle", instance_id=instance.id).pack(),
            )
        )

    for habit, log in habit_state or []:
        builder.row(*_habit_row(habit, log))

    builder.row(
        InlineKeyboardButton(
            text="➕ إضافة مهمة",
            callback_data=DayCB(action="add_task").pack(),
        ),
        InlineKeyboardButton(
            text="🔄 تحديث",
            callback_data=DayCB(action="refresh").pack(),
        ),
    )
    return builder.as_markup()
