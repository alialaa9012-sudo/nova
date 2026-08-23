"""اختبارات منطق اليوم المنطقي — أهم منطق في البوت وأسهله في الكسر."""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from tracker.services.timeutil import (
    at_time_on,
    format_arabic_date,
    format_time,
    is_last_day_of_month,
    is_week_end,
    logical_date,
    logical_day_bounds,
    month_bounds,
    week_bounds,
)

CAIRO = ZoneInfo("Africa/Cairo")


class TestLogicalDate:
    def test_afternoon_belongs_to_same_day(self):
        assert logical_date(datetime(2026, 8, 28, 15, 0)) == date(2026, 8, 28)

    def test_just_before_midnight_belongs_to_same_day(self):
        assert logical_date(datetime(2026, 8, 28, 23, 59)) == date(2026, 8, 28)

    def test_after_midnight_still_belongs_to_previous_day(self):
        # 00:30 ليلاً ما زالت "يوم 28" لأن الحد 4 فجراً
        assert logical_date(datetime(2026, 8, 29, 0, 30)) == date(2026, 8, 28)

    def test_just_before_boundary_belongs_to_previous_day(self):
        assert logical_date(datetime(2026, 8, 29, 3, 59)) == date(2026, 8, 28)

    def test_at_boundary_starts_new_day(self):
        assert logical_date(datetime(2026, 8, 29, 4, 0)) == date(2026, 8, 29)

    def test_bounds_span_exactly_24_hours(self):
        start, end = logical_day_bounds(date(2026, 8, 28), CAIRO)
        assert start == datetime(2026, 8, 28, 4, 0, tzinfo=CAIRO)
        assert end == datetime(2026, 8, 29, 4, 0, tzinfo=CAIRO)


class TestAtTimeOn:
    def test_morning_time_lands_on_same_calendar_day(self):
        moment = at_time_on(date(2026, 8, 28), time(11, 0), CAIRO)
        assert moment == datetime(2026, 8, 28, 11, 0, tzinfo=CAIRO)

    def test_review_at_midnight_lands_on_next_calendar_day(self):
        # مراجعة "يوم 28" الساعة 12:00 تقع فعلياً في 29 عند 00:00
        moment = at_time_on(date(2026, 8, 28), time(0, 0), CAIRO)
        assert moment == datetime(2026, 8, 29, 0, 0, tzinfo=CAIRO)

    def test_review_moment_is_inside_its_logical_day(self):
        day = date(2026, 8, 28)
        start, end = logical_day_bounds(day, CAIRO)
        assert start < at_time_on(day, time(0, 0), CAIRO) < end


class TestWeekBounds:
    def test_saturday_starts_the_week(self):
        # 2026-08-29 هو سبت
        start, end = week_bounds(date(2026, 8, 29))
        assert start == date(2026, 8, 29)
        assert end == date(2026, 9, 4)

    def test_friday_ends_the_week(self):
        start, end = week_bounds(date(2026, 8, 28))
        assert end == date(2026, 8, 28)
        assert start == date(2026, 8, 22)

    def test_midweek_day_resolves_to_same_week(self):
        assert week_bounds(date(2026, 8, 25)) == (date(2026, 8, 22), date(2026, 8, 28))

    def test_is_week_end_only_true_on_friday(self):
        assert is_week_end(date(2026, 8, 28)) is True
        assert is_week_end(date(2026, 8, 29)) is False


class TestMonthBounds:
    def test_regular_month(self):
        assert month_bounds(date(2026, 8, 15)) == (date(2026, 8, 1), date(2026, 8, 31))

    def test_february_non_leap(self):
        assert month_bounds(date(2026, 2, 10)) == (date(2026, 2, 1), date(2026, 2, 28))

    def test_february_leap(self):
        assert month_bounds(date(2028, 2, 10)) == (date(2028, 2, 1), date(2028, 2, 29))

    def test_december_rolls_over(self):
        assert month_bounds(date(2026, 12, 5)) == (date(2026, 12, 1), date(2026, 12, 31))

    def test_is_last_day_of_month(self):
        assert is_last_day_of_month(date(2026, 8, 31)) is True
        assert is_last_day_of_month(date(2026, 8, 30)) is False


class TestFormatting:
    def test_arabic_date(self):
        assert format_arabic_date(date(2026, 8, 28)) == "الجمعة، 28 أغسطس 2026"

    def test_time_morning(self):
        assert format_time(time(11, 0)) == "11:00 ص"

    def test_time_afternoon(self):
        assert format_time(time(15, 0)) == "3:00 م"

    def test_time_midnight(self):
        assert format_time(time(0, 0)) == "12:00 ص"

    def test_time_noon(self):
        assert format_time(time(12, 30)) == "12:30 م"
