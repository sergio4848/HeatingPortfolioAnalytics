"""Atomic tenant/day AI reservations; content remains tenant-scoped in entities."""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_quotas",
        sa.Column("tenant", sa.String(80), primary_key=True),
        sa.Column("day", sa.String(10), primary_key=True),
        sa.Column("requests", sa.Integer(), nullable=False),
        sa.Column("tokens", sa.Integer(), nullable=False),
        sa.Column("cost_microusd", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("ai_quotas")
