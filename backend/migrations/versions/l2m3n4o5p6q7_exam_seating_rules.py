"""exams: seating rules (order, spacing, accommodation room)

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("exams", sa.Column("seating_rules", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("exams", "seating_rules")
