"""قراءة نص حر عربي وتحويله إلى مهمة: العنوان، الوقت، والتكرار.

مثال: «كل سبت جيم 6م» ← عنوان "جيم"، وقت 18:00، تكرار كل سبت.
الفلسفة: لا نخمّن. لا يُقرأ رقمٌ كوقت إلا إذا صاحبته علامة وقت صريحة
(نقطتان أو ص/م)، حتى لا تتحوّل «90 دقيقة» إلى الساعة 90.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import time

from tracker.db.models import Recurrence

# تحويل الأرقام العربية الهندية إلى لاتينية
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

# أسماء الأيام بترقيم بايثون (الاثنين=0 ... الأحد=6)
WEEKDAY_NAMES: dict[str, int] = {
    "الاثنين": 0, "الإثنين": 0, "الاتنين": 0, "اثنين": 0,
    "الثلاثاء": 1, "الثلاثا": 1, "ثلاثاء": 1,
    "الأربعاء": 2, "الاربعاء": 2, "اربعاء": 2, "أربعاء": 2,
    "الخميس": 3, "خميس": 3,
    "الجمعة": 4, "الجمعه": 4, "جمعة": 4, "جمعه": 4,
    "السبت": 5, "سبت": 5,
    "الأحد": 6, "الاحد": 6, "أحد": 6, "احد": 6,
}

_DAILY_WORDS = ("كل يوم", "يومياً", "يوميا", "كل يوم", "يومي")
_WEEKLY_WORDS = ("كل أسبوع", "كل اسبوع", "أسبوعياً", "اسبوعيا", "أسبوعيا")

# 9:30 م  |  21:30  |  9 م
_TIME_WITH_COLON = re.compile(r"(?<!\d)(\d{1,2}):(\d{2})\s*(ص|م|صباحا|صباحاً|مساء|مساءً)?")
_TIME_BARE_MERIDIEM = re.compile(r"(?<!\d)(\d{1,2})\s*(ص|م|صباحا|صباحاً|مساء|مساءً)(?!\w)")

_MORNING = {"ص", "صباحا", "صباحاً"}


@dataclass(frozen=True)
class ParsedTask:
    title: str
    scheduled_time: time | None = None
    recurrence: Recurrence = Recurrence.NONE
    custom_days: list[int] | None = None


def _normalize(text: str) -> str:
    return text.translate(_ARABIC_DIGITS).strip()


def _to_24h(hour: int, minute: int, meridiem: str | None) -> time | None:
    if meridiem:
        if hour < 1 or hour > 12:
            return None
        if meridiem in _MORNING:
            hour = 0 if hour == 12 else hour
        else:
            hour = 12 if hour == 12 else hour + 12
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return time(hour, minute)


def _extract_time(text: str) -> tuple[str, time | None]:
    match = _TIME_WITH_COLON.search(text)
    if match:
        parsed = _to_24h(int(match.group(1)), int(match.group(2)), match.group(3))
        if parsed is not None:
            return (text[: match.start()] + text[match.end() :]), parsed

    match = _TIME_BARE_MERIDIEM.search(text)
    if match:
        parsed = _to_24h(int(match.group(1)), 0, match.group(2))
        if parsed is not None:
            return (text[: match.start()] + text[match.end() :]), parsed

    return text, None


def _extract_recurrence(text: str) -> tuple[str, Recurrence, list[int] | None]:
    lowered = text

    for name, weekday in WEEKDAY_NAMES.items():
        for prefix in ("كل ", "كلّ "):
            token = prefix + name
            if token in lowered:
                return lowered.replace(token, " ", 1), Recurrence.CUSTOM_DAYS, [weekday]

    for word in _DAILY_WORDS:
        if word in lowered:
            return lowered.replace(word, " ", 1), Recurrence.DAILY, None

    for word in _WEEKLY_WORDS:
        if word in lowered:
            return lowered.replace(word, " ", 1), Recurrence.WEEKLY, None

    return lowered, Recurrence.NONE, None


def parse_task(text: str) -> ParsedTask | None:
    """يحوّل نصاً حراً إلى مهمة، أو None إذا لم يتبقّ عنوان ذو معنى."""
    working = _normalize(text)
    if not working:
        return None

    working, recurrence, custom_days = _extract_recurrence(working)
    working, scheduled = _extract_time(working)

    title = re.sub(r"\s+", " ", working).strip(" -–—:،,")
    if not title:
        return None

    return ParsedTask(
        title=title,
        scheduled_time=scheduled,
        recurrence=recurrence,
        custom_days=custom_days,
    )
