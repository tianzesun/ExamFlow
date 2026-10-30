"""rooms: layout (rows, seats per row, aisles)

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "n4o5p6q7r8s9"
down_revision = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rooms", sa.Column("layout", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("rooms", "layout")
