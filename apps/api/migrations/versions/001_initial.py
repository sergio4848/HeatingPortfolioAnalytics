"""Tenant-scoped entity storage. Explicit single schema migration."""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "entities",
        sa.Column("tenant", sa.String(80), primary_key=True),
        sa.Column("kind", sa.String(40), primary_key=True),
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column("data", sa.JSON(), nullable=False),
    )


def downgrade():
    op.drop_table("entities")
