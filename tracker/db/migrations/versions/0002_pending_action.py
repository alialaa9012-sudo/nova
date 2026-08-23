"""pending action on users

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-23
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("pending_action", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("pending_ref", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "pending_ref")
    op.drop_column("users", "pending_action")
