"""وسطاء aiogram: قصر الوصول على مالك البوت، وفتح جلسة قاعدة بيانات لكل تحديث."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Update

from tracker.config import get_settings
from tracker.db.session import session_scope
from tracker.services.bootstrap import get_or_create_user
from tracker.services.timeutil import logical_date, now_in

logger = logging.getLogger(__name__)


def _extract_user_id(event: TelegramObject) -> int | None:
    if isinstance(event, Update):
        if event.message and event.message.from_user:
            return event.message.from_user.id
        if event.callback_query and event.callback_query.from_user:
            return event.callback_query.from_user.id
        if event.edited_message and event.edited_message.from_user:
            return event.edited_message.from_user.id
    return None


class AllowlistMiddleware(BaseMiddleware):
    """يتجاهل أي تحديث لا يأتي من المعرّف المسموح به.

    الصمت مقصود: البوت لا يردّ على الغرباء أصلاً حتى لا يكشف عن نفسه.
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        allowed = get_settings().allowed_user_id
        user_id = _extract_user_id(event)

        if user_id is None or user_id != allowed:
            if user_id is not None:
                logger.warning("تم تجاهل تحديث من مستخدم غير مسموح: %s", user_id)
            return None

        return await handler(event, data)


class DatabaseMiddleware(BaseMiddleware):
    """يفتح جلسة واحدة لكل تحديث ويضع المستخدم واليوم المنطقي في السياق."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        settings = get_settings()
        tg_user = None
        if isinstance(event, Update):
            source = event.message or event.callback_query or event.edited_message
            tg_user = getattr(source, "from_user", None)

        async with session_scope() as session:
            today = logical_date(now_in(settings.tz))
            user, created = await get_or_create_user(
                session,
                tg_user.id if tg_user else settings.allowed_user_id,
                username=getattr(tg_user, "username", None),
                first_name=getattr(tg_user, "first_name", None),
                today=today,
            )
            data["session"] = session
            data["user"] = user
            data["is_new_user"] = created
            data["today"] = today
            return await handler(event, data)


__all__ = ["AllowlistMiddleware", "DatabaseMiddleware"]
