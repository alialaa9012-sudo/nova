"""حسابات التاريخ والوقت — قلب منطق "اليوم" في هذا البوت.

اليوم المنطقي لا يبدأ من منتصف الليل بل من ``day_boundary_hour`` (افتراضياً 4 فجراً).
لذلك المراجعة الليلية الساعة 12:00 تُراجع اليوم الذي انتهى للتو، لا اليوم التالي.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

DAY_BOUNDARY_HOUR = 4
# السبت بترقيم بايثون (الاثنين=0 ... الأحد=6)
WEEK_START_SATURDAY = 5

ARABIC_WEEKDAYS = {
    0: "الاثنين",
    1: "الثلاثاء",
    2: "الأربعاء",
    3: "الخميس",
    4: "الجمعة",
    5: "السبت",
    6: "الأحد",
}

ARABIC_MONTHS = {
    1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل",
    5: "مايو", 6: "يونيو", 7: "يوليو", 8: "أغسطس",
    9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر",
}


def now_in(tz: ZoneInfo) -> datetime:
    return datetime.now(tz)


def logical_date(moment: datetime, boundary_hour: int = DAY_BOUNDARY_HOUR) -> date:
    """اليوم المنطقي الذي تنتمي إليه هذه اللحظة.

    أي لحظة قبل ``boundary_hour`` تُحسب على اليوم السابق، فمن سهر بعد منتصف
    الليل يظل يسجّل على يوم أمس.
    """
    if moment.hour < boundary_hour:
        return (moment - timedelta(days=1)).date()
    return moment.date()


def logical_day_bounds(
    day: date, tz: ZoneInfo, boundary_hour: int = DAY_BOUNDARY_HOUR
) -> tuple[datetime, datetime]:
    """بداية ونهاية اليوم المنطقي كلحظتين مُوقّتتين."""
    start = datetime.combine(day, time(boundary_hour, 0), tzinfo=tz)
    return start, start + timedelta(days=1)


def at_time_on(day: date, at: time, tz: ZoneInfo, boundary_hour: int = DAY_BOUNDARY_HOUR) -> datetime:
    """اللحظة الفعلية لوقتٍ معيّن ضمن يوم منطقي.

    وقت أقل من حدّ اليوم (مثل 00:00 للمراجعة) يقع فعلياً في اليوم التقويمي التالي.
    """
    calendar_day = day + timedelta(days=1) if at.hour < boundary_hour else day
    return datetime.combine(calendar_day, at, tzinfo=tz)


def week_bounds(day: date, week_start: int = WEEK_START_SATURDAY) -> tuple[date, date]:
    """أول وآخر يوم في الأسبوع الذي يقع فيه ``day`` (شامل الطرفين)."""
    offset = (day.weekday() - week_start) % 7
    start = day - timedelta(days=offset)
    return start, start + timedelta(days=6)


def month_bounds(day: date) -> tuple[date, date]:
    """أول وآخر يوم في شهر ``day`` (شامل الطرفين)."""
    start = day.replace(day=1)
    next_month = (start + timedelta(days=32)).replace(day=1)
    return start, next_month - timedelta(days=1)


def is_last_day_of_month(day: date) -> bool:
    return day == month_bounds(day)[1]


def is_week_end(day: date, week_start: int = WEEK_START_SATURDAY) -> bool:
    return day == week_bounds(day, week_start)[1]


def format_arabic_date(day: date) -> str:
    """مثال: الجمعة، 28 أغسطس 2026"""
    return f"{ARABIC_WEEKDAYS[day.weekday()]}، {day.day} {ARABIC_MONTHS[day.month]} {day.year}"


def format_time(at: time) -> str:
    """صيغة 12 ساعة عربية: 11:00 ص / 3:00 م"""
    suffix = "ص" if at.hour < 12 else "م"
    hour = at.hour % 12 or 12
    return f"{hour}:{at.minute:02d} {suffix}"
