"""الملخص السريع لليوم — سطر واحد يكتبه المستخدم متى شاء."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.db.models import DailyNote, User


async def text_for(session: AsyncSession, user: User, day: date) -> str | None:
    return await session.scalar(
        select(DailyNote.content).where(
            DailyNote.user_id == user.id, DailyNote.note_date == day
        )
    )


async def save(session: AsyncSession, user: User, day: date, content: str) -> DailyNote | None:
    """يكتب أو يستبدل ملخص اليوم. نص فارغ يمسحه."""
    text = content.strip()
    existing = await session.scalar(
        select(DailyNote).where(
            DailyNote.user_id == user.id, DailyNote.note_date == day
        )
    )

    if not text:
        if existing is not None:
            await session.delete(existing)
            await session.flush()
        return None

    if existing is None:
        existing = DailyNote(user_id=user.id, note_date=day, content=text)
        session.add(existing)
    else:
        existing.content = text

    await session.flush()
    return existing
