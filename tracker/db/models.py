"""نماذج قاعدة البيانات — SQLAlchemy 2.0.

كل جدول مربوط بـ user_id حتى لو المستخدم واحد الآن، حتى يمكن فتح البوت
لأكثر من مستخدم لاحقاً بلا إعادة كتابة.

اصطلاح أيام الأسبوع في ``active_days`` و``custom_days``:
    ترقيم بايثون ``date.weekday()`` أي الاثنين=0 ... الأحد=6.
"""

from __future__ import annotations

import enum
from datetime import date, datetime, time

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Recurrence(str, enum.Enum):
    """كيفية تكرار المهمة."""

    NONE = "none"          # مرة واحدة في تاريخ محدد
    DAILY = "daily"        # كل يوم
    WEEKLY = "weekly"      # مرة أسبوعياً في نفس يوم الإنشاء
    CUSTOM_DAYS = "custom_days"  # أيام محددة من الأسبوع


class HabitKind(str, enum.Enum):
    """طريقة قياس العادة."""

    BOOLEAN = "boolean"          # نعم/لا — مثل غسل الأسنان
    COUNTER = "counter"          # عدّاد — مثل 3 لتر ماء أو 5 جمل
    TIME_TARGET = "time_target"  # وقت مستهدف — محجوز للمرحلة 2


class ReminderKind(str, enum.Enum):
    """نوع الرسالة التلقائية في الطابور."""

    MORNING = "morning"            # رسالة اليوم
    MIDDAY = "midday"              # تذكير بالناقص
    REVIEW = "review"              # المراجعة الليلية
    EVENT = "event"                # تذكير قبل حدث
    WEEKLY_REPORT = "weekly"       # مدمج مع مراجعة ليلة الجمعة
    MONTHLY_REPORT = "monthly"     # مدمج مع مراجعة آخر ليلة بالشهر
    SCHEDULE_ASK = "schedule_ask"  # سؤال مواعيد الأسبوع الجاي


class User(Base):
    """المستخدم وتفضيلاته الزمنية."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # معرّفات تليجرام تتجاوز سعة INTEGER (مثال: 6493959847) فلا بد من BIGINT.
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(64))
    first_name: Mapped[str | None] = mapped_column(String(128))

    timezone: Mapped[str] = mapped_column(String(64), default="Africa/Cairo")
    # السبت = 5 بترقيم بايثون (الاثنين=0)
    week_start: Mapped[int] = mapped_column(Integer, default=5)
    # قبل هذه الساعة يظل اليوم السابق هو "اليوم"
    day_boundary_hour: Mapped[int] = mapped_column(Integer, default=4)

    is_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    # معرّف رسالة "اليوم" الحالية حتى نُحرّرها في مكانها بدل إرسال رسالة جديدة
    today_message_id: Mapped[int | None] = mapped_column(BigInteger)
    today_message_date: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    habits: Mapped[list["Habit"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Schedule(Base):
    """مواعيد الرسائل الثلاث، بصف جديد كل مرة تتغيّر — فيبقى التاريخ محفوظاً."""

    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    effective_from: Mapped[date] = mapped_column(Date, index=True)

    morning_time: Mapped[time] = mapped_column(Time, default=time(11, 0))
    midday_time: Mapped[time | None] = mapped_column(Time, default=time(15, 0))
    review_time: Mapped[time] = mapped_column(Time, default=time(0, 0))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="schedules")


class Task(Base):
    """قالب المهمة — قد تكون لمرة واحدة أو متكررة."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    scheduled_time: Mapped[time | None] = mapped_column(Time)

    recurrence: Mapped[Recurrence] = mapped_column(
        Enum(Recurrence, native_enum=False, length=20), default=Recurrence.NONE
    )
    # لـ CUSTOM_DAYS: قائمة أرقام أيام مثل [0, 2, 4]
    custom_days: Mapped[list[int] | None] = mapped_column(JSON)
    # لـ NONE: التاريخ الوحيد الذي تظهر فيه
    due_date: Mapped[date | None] = mapped_column(Date)

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="tasks")
    instances: Mapped[list["TaskInstance"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class TaskInstance(Base):
    """نسخة اليوم من المهمة — هنا يحدث الإنجاز والترحيل."""

    __tablename__ = "task_instances"
    __table_args__ = (
        UniqueConstraint("task_id", "occurrence_date", name="uq_task_occurrence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    occurrence_date: Mapped[date] = mapped_column(Date, index=True)

    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    carried_from_date: Mapped[date | None] = mapped_column(Date)

    task: Mapped[Task] = relationship(back_populates="instances")


class Habit(Base):
    """تعريف العادة.

    ``target_value`` هو حدّ اعتبار العادة منجزة، و``stretch_value`` حدّ التميّز.
    مثال القراءة: الهدف 2 صفحات والتميّز 5.
    """

    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128))
    emoji: Mapped[str] = mapped_column(String(8), default="✅")

    kind: Mapped[HabitKind] = mapped_column(
        Enum(HabitKind, native_enum=False, length=20), default=HabitKind.BOOLEAN
    )
    target_value: Mapped[float] = mapped_column(Float, default=1.0)
    stretch_value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(32))
    # خطوات أزرار التسجيل السريع، مثل [0.5, 1]
    quick_steps: Mapped[list[float] | None] = mapped_column(JSON)
    # هل تُطلب كتابة نص عند التسجيل؟ (عادة الجمل الإنجليزية)
    captures_text: Mapped[bool] = mapped_column(Boolean, default=False)

    # أيام الأسبوع التي تنشط فيها العادة؛ None = كل الأيام
    active_days: Mapped[list[int] | None] = mapped_column(JSON)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="habits")
    logs: Mapped[list["HabitLog"]] = relationship(
        back_populates="habit", cascade="all, delete-orphan"
    )


class HabitLog(Base):
    """قيمة العادة المسجّلة في يوم بعينه."""

    __tablename__ = "habit_logs"
    __table_args__ = (
        UniqueConstraint("habit_id", "log_date", name="uq_habit_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    habit_id: Mapped[int] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    log_date: Mapped[date] = mapped_column(Date, index=True)

    value: Mapped[float] = mapped_column(Float, default=0.0)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    is_stretch: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    habit: Mapped[Habit] = relationship(back_populates="logs")
    vocab_entries: Mapped[list["VocabEntry"]] = relationship(
        back_populates="habit_log", cascade="all, delete-orphan"
    )


class VocabEntry(Base):
    """قاموس الجمل الإنجليزية — كل جملة كتبها المستخدم بتاريخها."""

    __tablename__ = "vocab_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    habit_log_id: Mapped[int | None] = mapped_column(
        ForeignKey("habit_logs.id", ondelete="SET NULL")
    )
    content: Mapped[str] = mapped_column(Text)
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    habit_log: Mapped[HabitLog | None] = relationship(back_populates="vocab_entries")


class Event(Base):
    """حدث قادم بتذكيره."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    event_date: Mapped[date] = mapped_column(Date, index=True)
    event_time: Mapped[time | None] = mapped_column(Time)
    category: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)
    reminder_minutes_before: Mapped[int] = mapped_column(Integer, default=30)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class DailyNote(Base):
    """الملخص السريع النصي لليوم."""

    __tablename__ = "daily_notes"
    __table_args__ = (UniqueConstraint("user_id", "note_date", name="uq_note_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    note_date: Mapped[date] = mapped_column(Date, index=True)
    content: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DailyReview(Base):
    """نتيجة المراجعة الليلية — الرقمان محفوظان منفصلين."""

    __tablename__ = "daily_reviews"
    __table_args__ = (UniqueConstraint("user_id", "review_date", name="uq_review_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    review_date: Mapped[date] = mapped_column(Date, index=True)

    tasks_pct: Mapped[float] = mapped_column(Float, default=0.0)
    habits_pct: Mapped[float] = mapped_column(Float, default=0.0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    missed_count: Mapped[int] = mapped_column(Integer, default=0)
    mood: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    carried_task_ids: Mapped[list[int] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Reminder(Base):
    """طابور التنفيذ الدائم — قلب موثوقية الإشعارات.

    كل رسالة تلقائية مستقبلية صفٌّ هنا بوقت استحقاقها. نبضة ``/cron/tick``
    الخارجية تلتقط المستحق وترسله، فينجو الطابور من إعادة النشر ومن نوم الخدمة.
    """

    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[ReminderKind] = mapped_column(
        Enum(ReminderKind, native_enum=False, length=20)
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    payload: Mapped[dict | None] = mapped_column(JSON)

    is_sent: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
