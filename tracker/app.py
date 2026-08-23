"""نقطة الدخول: FastAPI تستضيف webhook تليجرام ونبضة التذكيرات في عملية واحدة."""

from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from aiogram.types import Update
from fastapi import FastAPI, Header, HTTPException, Request

from tracker.bot.setup import BOT_COMMANDS, build_bot, build_dispatcher
from tracker.config import get_settings
from tracker.db.session import dispose_engine, session_scope
from tracker.services.reminders import run_tick
from tracker.services.timeutil import now_in

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

bot = build_bot()
dispatcher = build_dispatcher()


WEBHOOK_ATTEMPTS = 3
WEBHOOK_RETRY_SECONDS = 2

# حالة الإقلاع، تُعرض على /health حتى يكون العطل مرئياً بلا لوجز
startup_state: dict[str, object] = {"webhook": "not-configured", "commands": "unknown"}


async def _register_webhook(settings) -> str:
    """يضبط الـwebhook مع إعادة محاولة قصيرة.

    الفشل لا يُسقط التطبيق عمداً: على الطبقة المجانية تعثّر شبكة لحظة
    الإقلاع كان سيوقع الحاوية في حلقة إعادة تشغيل تحرق الساعات المجانية
    بلا أي تشخيص. نُبقي الخدمة حيّة ونُظهر السبب على /health.
    """
    for attempt in range(1, WEBHOOK_ATTEMPTS + 1):
        try:
            await bot.set_webhook(
                url=settings.webhook_url,
                secret_token=settings.webhook_secret,
                drop_pending_updates=True,
            )
            logger.info("تم ضبط الـwebhook على %s", settings.webhook_url)
            return "ok"
        except Exception:
            logger.warning(
                "فشلت محاولة ضبط الـwebhook %s من %s", attempt, WEBHOOK_ATTEMPTS,
                exc_info=True,
            )
            if attempt < WEBHOOK_ATTEMPTS:
                await asyncio.sleep(WEBHOOK_RETRY_SECONDS * attempt)

    logger.error(
        "تعذّر ضبط الـwebhook بعد %s محاولات — الخدمة شغّالة لكنها لن تستقبل "
        "رسائل حتى يُضبط. أعد النشر أو تحقّق من PUBLIC_URL.",
        WEBHOOK_ATTEMPTS,
    )
    return "failed"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    if settings.public_url:
        startup_state["webhook"] = await _register_webhook(settings)
    else:
        logger.warning("PUBLIC_URL غير مضبوط — لم يُضبط أي webhook.")
        startup_state["webhook"] = "not-configured"

    try:
        await bot.set_my_commands(BOT_COMMANDS)
        startup_state["commands"] = "ok"
    except Exception:
        # قائمة الأوامر تحسين للواجهة — فشلها لا يمنع تشغيل البوت
        logger.warning("تعذّر تسجيل قائمة الأوامر", exc_info=True)
        startup_state["commands"] = "failed"

    yield

    await bot.session.close()
    await dispose_engine()


app = FastAPI(title="Daily Tracker", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, object]:
    """حالة الخدمة — تشمل نتيجة ضبط الـwebhook حتى يكون العطل قابلاً للتشخيص."""
    return {"status": "ok", **startup_state}


@app.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, bool]:
    settings = get_settings()
    # تليجرام وحده يعرف هذا السر؛ أي طلب آخر مرفوض.
    # المقارنة ثابتة الزمن حتى لا يسرّب زمن الرد أي شيء عن السر.
    if not secrets.compare_digest(
        x_telegram_bot_api_secret_token or "", settings.webhook_secret
    ):
        raise HTTPException(status_code=403, detail="bad secret token")

    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dispatcher.feed_update(bot, update)
    return {"ok": True}


@app.get("/cron/tick")
async def cron_tick(key: str = "") -> dict[str, object]:
    """نبضة خارجية كل دقيقة: توقظ الخدمة وتُنفّذ التذكيرات المستحقة.

    آمنة للاستدعاء المتكرر: ما أُرسل يُعلَّم فلا يُرسل مرتين، وتوليد
    تذكيرات الأفق عملية idempotent.
    """
    settings = get_settings()
    if not secrets.compare_digest(key, settings.cron_secret):
        raise HTTPException(status_code=403, detail="bad cron key")

    async with session_scope() as session:
        result = await run_tick(bot, session, now_in(settings.tz))

    return {"ok": True, **result.as_dict()}
