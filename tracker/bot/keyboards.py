"""لوحات الأزرار وبيانات النداءات."""

from __future__ import annotations

from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from tracker.db.models import Task, TaskInstance
from tracker.services.render import task_label


class TaskCB(CallbackData, prefix="t"):
    """نداء يخصّ مهمة بعينها."""

    action: str  # toggle
    instance_id: int


class DayCB(CallbackData, prefix="d"):
    """نداء يخصّ رسالة اليوم ككل."""

    action: str  # refresh | add_task


def today_keyboard(pairs: list[tuple[Task, TaskInstance]]) -> InlineKeyboardMarkup:
    """زرّ لكل مهمة (ضغطة واحدة = تبديل الحالة) وصفّ إجراءات أسفلها."""
    builder = InlineKeyboardBuilder()

    for task, instance in pairs:
        builder.row(
            InlineKeyboardButton(
                text=task_label(task, instance),
                callback_data=TaskCB(action="toggle", instance_id=instance.id).pack(),
            )
        )

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
