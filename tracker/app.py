"""نقطة الدخول: FastAPI تستضيف webhook تليجرام ونبضة التذكيرات في عملية واحدة."""

from __future__ import annotations

import logging
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.public_url:
        await bot.set_webhook(
            url=settings.webhook_url,
            secret_token=settings.webhook_secret,
            drop_pending_updates=True,
        )
        logger.info("تم ضبط الـwebhook على %s", settings.webhook_url)

    try:
        await bot.set_my_commands(BOT_COMMANDS)
    except Exception:
        # قائمة الأوامر تحسين للواجهة — فشلها لا يمنع تشغيل البوت
        logger.warning("تعذّر تسجيل قائمة الأوامر", exc_info=True)
    else:
        logger.warning("PUBLIC_URL غير مضبوط — لم يُضبط أي webhook.")

    yield

    await bot.session.close()
    await dispose_engine()


app = FastAPI(title="Daily Tracker", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, bool]:
    settings = get_settings()
    if x_telegram_bot_api_secret_token != settings.webhook_secret:
        # تليجرام وحده يعرف هذا السر؛ أي طلب آخر مرفوض.
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
    if key != settings.cron_secret:
        raise HTTPException(status_code=403, detail="bad cron key")

    async with session_scope() as session:
        result = await run_tick(bot, session, now_in(settings.tz))

    return {"ok": True, **result.as_dict()}
