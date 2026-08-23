"""reminder for_day

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-23
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("for_day", sa.Date(), nullable=True))
    op.create_index("ix_reminders_for_day", "reminders", ["for_day"])


def downgrade() -> None:
    op.drop_index("ix_reminders_for_day", table_name="reminders")
    op.drop_column("reminders", "for_day")
