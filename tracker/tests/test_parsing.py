"""اختبارات قراءة النص الحر العربي."""

from datetime import time

from tracker.db.models import Recurrence
from tracker.services.parsing import parse_task


class TestTitleOnly:
    def test_plain_title(self):
        p = parse_task("قراءة 20 صفحة")
        assert p.title == "قراءة 20 صفحة"
        assert p.scheduled_time is None
        assert p.recurrence is Recurrence.NONE

    def test_number_without_time_marker_stays_in_title(self):
        """«90 دقيقة» رقمٌ في العنوان لا وقت — هذا أهم ما يميّز محلّلاً جيداً."""
        p = parse_task("مذاكرة 90 دقيقة")
        assert p.title == "مذاكرة 90 دقيقة"
        assert p.scheduled_time is None

    def test_empty_input_returns_none(self):
        assert parse_task("") is None
        assert parse_task("   ") is None

    def test_only_a_time_has_no_title(self):
        assert parse_task("9 م") is None


class TestTime:
    def test_bare_hour_with_evening_marker(self):
        p = parse_task("مذاكرة 90 دقيقة 9م")
        assert p.title == "مذاكرة 90 دقيقة"
        assert p.scheduled_time == time(21, 0)

    def test_bare_hour_with_morning_marker(self):
        p = parse_task("جري 6 ص")
        assert p.scheduled_time == time(6, 0)
        assert p.title == "جري"

    def test_colon_time_with_marker(self):
        p = parse_task("اجتماع 10:30 ص")
        assert p.scheduled_time == time(10, 30)
        assert p.title == "اجتماع"

    def test_colon_time_24h_without_marker(self):
        p = parse_task("مكالمة 21:15")
        assert p.scheduled_time == time(21, 15)
        assert p.title == "مكالمة"

    def test_twelve_pm_is_noon(self):
        assert parse_task("غداء 12 م").scheduled_time == time(12, 0)

    def test_twelve_am_is_midnight(self):
        assert parse_task("مراجعة 12 ص").scheduled_time == time(0, 0)

    def test_arabic_indic_digits(self):
        p = parse_task("مذاكرة ٩ م")
        assert p.scheduled_time == time(21, 0)

    def test_invalid_hour_is_not_a_time(self):
        p = parse_task("مهمة 25:99")
        assert p.scheduled_time is None
        assert "25:99" in p.title


class TestRecurrence:
    def test_daily(self):
        p = parse_task("كل يوم مذاكرة")
        assert p.recurrence is Recurrence.DAILY
        assert p.title == "مذاكرة"

    def test_daily_suffix_form(self):
        p = parse_task("مذاكرة يومياً")
        assert p.recurrence is Recurrence.DAILY
        assert p.title == "مذاكرة"

    def test_specific_weekday(self):
        p = parse_task("كل سبت جيم")
        assert p.recurrence is Recurrence.CUSTOM_DAYS
        assert p.custom_days == [5]
        assert p.title == "جيم"

    def test_weekday_with_definite_article(self):
        p = parse_task("كل الجمعة مراجعة الأسبوع")
        assert p.custom_days == [4]
        assert p.title == "مراجعة الأسبوع"

    def test_weekly(self):
        p = parse_task("كل أسبوع تنظيف")
        assert p.recurrence is Recurrence.WEEKLY
        assert p.title == "تنظيف"

    def test_recurrence_and_time_together(self):
        p = parse_task("كل سبت جيم 6م")
        assert p.recurrence is Recurrence.CUSTOM_DAYS
        assert p.custom_days == [5]
        assert p.scheduled_time == time(18, 0)
        assert p.title == "جيم"

    def test_no_recurrence_keyword(self):
        assert parse_task("مشروع العميل").recurrence is Recurrence.NONE
