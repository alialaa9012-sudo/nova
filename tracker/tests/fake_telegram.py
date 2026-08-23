"""بوت وهمي يسجّل ما كان سيُرسل بدل الاتصال بتليجرام.

الجلسة هنا لا تفتح أي اتصال شبكة إطلاقاً، فالاختبارات تعمل في أي بيئة.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession
from aiogram.enums import ParseMode
from aiogram.methods import TelegramMethod
from aiogram.types import Chat
from aiogram.types import Message as TgMessage
from aiogram.types import Update, User

BOT_ID = 8801408443
BOT_USERNAME = "daily_tracker_test_bot"


class RecordingSession(BaseSession):
    """تسجّل كل نداء API في ``self.calls`` وتعيد ردّاً معقولاً."""

    def __init__(self) -> None:
        super().__init__()
        self.calls: list[TelegramMethod] = []
        self._message_id = 1000

    async def make_request(
        self, bot: Bot, method: TelegramMethod, timeout: int | None = None
    ) -> Any:
        self.calls.append(method)
        name = type(method).__name__

        if name in {"SendMessage", "EditMessageText"}:
            self._message_id += 1
            return TgMessage(
                message_id=self._message_id,
                date=datetime.now(),
                chat=Chat(id=getattr(method, "chat_id", BOT_ID), type="private"),
                from_user=User(id=BOT_ID, is_bot=True, first_name="Daily Tracker"),
                text=getattr(method, "text", None),
            )
        if name == "GetMe":
            return User(
                id=BOT_ID, is_bot=True, first_name="Daily Tracker", username=BOT_USERNAME
            )
        return True

    async def stream_content(
        self,
        url: str,
        headers: dict[str, Any] | None = None,
        timeout: int = 30,
        chunk_size: int = 65536,
        raise_for_status: bool = True,
    ) -> AsyncGenerator[bytes, None]:
        yield b""

    async def close(self) -> None:  # pragma: no cover - لا شيء لإغلاقه
        return None

    # --- مساعدات للاختبارات ---

    @property
    def sent_texts(self) -> list[str]:
        return [
            m.text
            for m in self.calls
            if type(m).__name__ in {"SendMessage", "EditMessageText"}
            and getattr(m, "text", None)
        ]

    def clear(self) -> None:
        self.calls.clear()


def make_bot() -> tuple[Bot, RecordingSession]:
    session = RecordingSession()
    bot = Bot(
        token=f"{BOT_ID}:test-token",
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    return bot, session


def text_update(text: str, user_id: int, update_id: int = 1) -> Update:
    """تحديث تليجرام لرسالة نصية واردة."""
    return Update(
        update_id=update_id,
        message=TgMessage(
            message_id=update_id,
            date=datetime.now(),
            chat=Chat(id=user_id, type="private"),
            from_user=User(
                id=user_id, is_bot=False, first_name="Ali", username="alial097"
            ),
            text=text,
        ),
    )
