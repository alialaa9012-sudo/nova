"""المراجعة الليلية: الترحيل، تقييم المزاج، والملخص السريع."""

from __future__ import annotations

from datetime import date

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy.ext.asyncio import AsyncSession

from tracker.bot.keyboards import ReviewCB
from tracker.db.models import User
from tracker.services import notes as note_service
from tracker.services import review as review_service
from tracker.services.render import render_note_saved, render_review

PENDING_NOTE = "note"


def review_keyboard(day: date, *, carryable: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()

    if carryable:
        builder.row(
            InlineKeyboardButton(
                text=f"↩️ رحّل {carryable} لبكرة",
                callback_data=ReviewCB(action="carry", day=day.isoformat(), value=0).pack(),
            ),
            InlineKeyboardButton(
                text="🗑 سيبهم",
                callback_data=ReviewCB(action="skip", day=day.isoformat(), value=0).pack(),
            ),
        )

    builder.row(
        *[
            InlineKeyboardButton(
                text=emoji,
                callback_data=ReviewCB(
                    action="mood", day=day.isoformat(), value=score
                ).pack(),
            )
            for score, emoji in review_service.MOODS.items()
        ]
    )
    return builder.as_markup()


async def send_review(bot, session: AsyncSession, user: User, day: date) -> None:
    summary = await review_service.summarize(session, user, day)
    await review_service.save(session, user, summary)
    await bot.send_message(
        user.telegram_id,
        render_review(summary) + "\n\nكيف كان يومك؟",
        reply_markup=review_keyboard(day, carryable=summary.carryable),
    )


async def handle_carry(
    query: CallbackQuery, callback_data: ReviewCB, session: AsyncSession, user: User
) -> None:
    day = date.fromisoformat(callback_data.day)
    carried = await review_service.carry_to_tomorrow(session, user, day)

    summary = await review_service.summarize(session, user, day)
    await review_service.save(session, user, summary, carried_ids=carried)

    await query.answer(f"اترحّلوا: {len(carried)}")
    await query.message.edit_reply_markup(
        reply_markup=review_keyboard(day, carryable=0)
    )
    if carried:
        word = "مهمة" if len(carried) == 1 else "مهام"
        await query.message.answer(f"↩️ {len(carried)} {word} انتقلت لبكرة.")


async def handle_skip(
    query: CallbackQuery, callback_data: ReviewCB, session: AsyncSession, user: User
) -> None:
    day = date.fromisoformat(callback_data.day)
    await query.answer("تمام، سبناهم.")
    await query.message.edit_reply_markup(
        reply_markup=review_keyboard(day, carryable=0)
    )


async def handle_mood(
    query: CallbackQuery, callback_data: ReviewCB, session: AsyncSession, user: User
) -> None:
    day = date.fromisoformat(callback_data.day)
    summary = await review_service.summarize(session, user, day)
    await review_service.save(session, user, summary, mood=callback_data.value)

    emoji = review_service.MOODS.get(callback_data.value, "🙂")
    await query.answer(f"{emoji} اتسجّل")
    await query.message.answer(f"{emoji} شكراً — اتسجّل تقييم اليوم. تصبح على خير.")


async def handle_note_command(
    message: Message, session: AsyncSession, user: User
) -> None:
    user.pending_action = PENDING_NOTE
    user.pending_ref = None
    await session.flush()
    await message.answer(
        "📝 اكتب ملخص اليوم في سطر:\n<i>أهم حاجة حصلت النهارده.</i>\n\n"
        "للإلغاء اكتب /cancel"
    )


async def consume_pending_note(
    message: Message, session: AsyncSession, user: User, today: date
) -> bool:
    if user.pending_action != PENDING_NOTE:
        return False

    user.pending_action = None
    user.pending_ref = None
    await session.flush()

    note = await note_service.save(session, user, today, message.text or "")
    if note is None:
        await message.answer("الملخص فاضي — مسحت اللي كان مكتوب.")
        return True

    await message.answer(render_note_saved(note.content))

    from tracker.bot.handlers.today import show_today

    await show_today(message, session, user, today)
    return True


async def handle_review_command(
    message: Message, session: AsyncSession, user: User, today: date
) -> None:
    """مراجعة عند الطلب، بلا انتظار موعدها."""
    summary = await review_service.summarize(session, user, today)
    await review_service.save(session, user, summary)
    await message.answer(
        render_review(summary) + "\n\nكيف كان يومك؟",
        reply_markup=review_keyboard(today, carryable=summary.carryable),
    )


def build_router() -> Router:
    router = Router(name="review")

    router.message.register(handle_note_command, Command("note"))
    router.message.register(handle_review_command, Command("review"))
    router.callback_query.register(handle_carry, ReviewCB.filter(F.action == "carry"))
    router.callback_query.register(handle_skip, ReviewCB.filter(F.action == "skip"))
    router.callback_query.register(handle_mood, ReviewCB.filter(F.action == "mood"))
    return router
