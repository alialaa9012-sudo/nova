"""إعدادات التطبيق — تُقرأ من متغيّرات البيئة فقط.

لا يوجد أي سر مكتوب في الكود. إذا نقص متغيّر مطلوب يفشل الإقلاع
برسالة واضحة بدلاً من العمل بشكل خاطئ في الإنتاج.
"""

from __future__ import annotations

from functools import lru_cache
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    bot_token: str = Field(alias="BOT_TOKEN")
    allowed_user_id: int = Field(alias="ALLOWED_USER_ID")
    database_url: str = Field(alias="DATABASE_URL")

    public_url: str = Field(default="", alias="PUBLIC_URL")
    webhook_secret: str = Field(default="dev-webhook-secret", alias="WEBHOOK_SECRET")
    cron_secret: str = Field(default="dev-cron-secret", alias="CRON_SECRET")
    timezone: str = Field(default="Africa/Cairo", alias="TIMEZONE")

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def async_database_url(self) -> str:
        """يحوّل رابط Postgres العادي إلى رابط asyncpg صالح.

        Neon يعطي رابطاً فيه ``sslmode`` و``channel_binding``؛ وasyncpg لا يفهم
        هذين المعاملين في الـURL، فنزيلهما ونمرّر SSL عبر connect_args بدلاً منهما.
        """
        url = self.database_url
        if url.startswith("sqlite"):
            return url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]

        parts = urlsplit(url)
        return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))

    @property
    def database_requires_ssl(self) -> bool:
        return not self.database_url.startswith("sqlite")

    @property
    def webhook_path(self) -> str:
        return "/webhook"

    @property
    def webhook_url(self) -> str:
        return f"{self.public_url.rstrip('/')}{self.webhook_path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
