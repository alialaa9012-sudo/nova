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
