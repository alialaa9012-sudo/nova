"""اختبارات بناء النصوص — دوال خالصة يراها المستخدم مباشرة."""

from datetime import date, datetime, time

from tracker.db.models import Task, TaskInstance
from tracker.services.render import (
    greeting,
    progress_bar,
    rating,
    render_today,
    task_label,
)


class TestProgressBar:
    def test_zero_is_all_empty(self):
        assert progress_bar(0) == "░" * 10

    def test_full_is_all_filled(self):
        assert progress_bar(100) == "█" * 10

    def test_half(self):
        assert progress_bar(50) == "█████░░░░░"

    def test_bar_is_always_the_same_width(self):
        for pct in (0, 7, 33, 50, 62, 99, 100):
            assert len(progress_bar(pct)) == 10

    def test_clamps_out_of_range(self):
        assert progress_bar(-20) == "░" * 10
        assert progress_bar(150) == "█" * 10


class TestRating:
    def test_boundaries(self):
        assert rating(100) == "ممتاز"
        assert rating(80) == "ممتاز"
        assert rating(79.9) == "جيد"
        assert rating(60) == "جيد"
        assert rating(59.9) == "متوسط"
        assert rating(40) == "متوسط"
        assert rating(39.9) == "ضعيف"
        assert rating(0) == "ضعيف"


class TestGreeting:
    def test_morning(self):
        assert greeting(datetime(2026, 8, 28, 11, 0)) == "صباح الخير"

    def test_afternoon(self):
        assert greeting(datetime(2026, 8, 28, 15, 0)) == "مساء الخير"

    def test_midnight_is_morning(self):
        assert greeting(datetime(2026, 8, 29, 0, 0)) == "صباح الخير"


class TestTaskLabel:
    def test_undone_box(self):
        label = task_label(Task(title="قراءة"), TaskInstance(is_done=False))
        assert label == "⬜ قراءة"

    def test_done_box(self):
        label = task_label(Task(title="قراءة"), TaskInstance(is_done=True))
        assert label == "✅ قراءة"

    def test_includes_time_when_scheduled(self):
        label = task_label(
            Task(title="جيم", scheduled_time=time(18, 0)), TaskInstance(is_done=False)
        )
        assert label == "⬜ 6:00 م · جيم"

    def test_long_title_is_truncated(self):
        label = task_label(Task(title="ا" * 80), TaskInstance(is_done=False))
        assert len(label) < 40
        assert label.endswith("…")


class TestRenderToday:
    def _render(self, **kw):
        base = dict(
            name="علي",
            now=datetime(2026, 8, 28, 11, 0),
            day=date(2026, 8, 28),
            task_done=2,
            task_total=4,
            tasks_pct=50.0,
        )
        base.update(kw)
        return render_today(**base)

    def test_has_greeting_and_date(self):
        text = self._render()
        assert "صباح الخير، علي" in text
        assert "الجمعة، 28 أغسطس 2026" in text

    def test_shows_counts_and_rating(self):
        text = self._render()
        assert "2 من 4" in text
        assert "50%" in text
        assert "متوسط" in text

    def test_empty_day_message(self):
        text = self._render(task_done=0, task_total=0, tasks_pct=0.0)
        assert "لا توجد مهام بعد" in text
        assert "0 من 0" not in text

    def test_celebrates_only_at_full_completion(self):
        assert "🎉" in self._render(task_done=4, task_total=4, tasks_pct=100.0)
        assert "🎉" not in self._render(task_done=3, task_total=4, tasks_pct=75.0)

    def test_mentions_carried_tasks(self):
        assert "↩️ 1 مهمة مرحّلة" in self._render(carried_count=1)
        assert "↩️ 3 مهام مرحّلة" in self._render(carried_count=3)
        assert "مرحّلة" not in self._render(carried_count=0)
