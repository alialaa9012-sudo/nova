"""اختبارات نقطة النبضة — بوابتها سرٌّ، وأي مفتاح خاطئ يُرفض."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from tracker.app import cron_tick
from tracker.config import get_settings


class TestCronAuth:
    async def test_wrong_key_is_rejected(self):
        with pytest.raises(HTTPException) as exc:
            await cron_tick(key="not-the-key")
        assert exc.value.status_code == 403

    async def test_missing_key_is_rejected(self):
        with pytest.raises(HTTPException) as exc:
            await cron_tick()
        assert exc.value.status_code == 403

    async def test_correct_key_passes_the_gate(self, wired):
        # مع مفتاح صحيح لا يُرفع 403؛ التنفيذ نفسه مغطّى في اختبارات النبضة
        settings = get_settings()
        result = await cron_tick(key=settings.cron_secret)
        assert result["ok"] is True
        assert "sent" in result


class TestStartupResilience:
    """فشل ضبط الـwebhook يجب ألا يُسقط الخدمة — الحلقة تحرق الساعات المجانية."""

    async def test_webhook_failure_is_reported_not_fatal(self, monkeypatch):
        from tracker import app as app_module

        async def always_fails(**kwargs):
            raise RuntimeError("تليجرام غير متاح")

        monkeypatch.setattr(app_module.bot, "set_webhook", always_fails)
        monkeypatch.setattr(app_module, "WEBHOOK_RETRY_SECONDS", 0)

        state = await app_module._register_webhook(get_settings())
        assert state == "failed"

    async def test_health_reports_startup_state(self):
        from tracker.app import health, startup_state

        startup_state["webhook"] = "failed"
        body = await health()
        assert body["status"] == "ok"
        assert body["webhook"] == "failed"
        startup_state["webhook"] = "not-configured"
