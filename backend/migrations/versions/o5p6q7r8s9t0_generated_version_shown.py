"""generated_exams: version_shown (whether the paper carries a VERSION badge)

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
"""

from alembic import op
import sqlalchemy as sa

revision = "o5p6q7r8s9t0"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_exams", sa.Column("version_shown", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("generated_exams", "version_shown")
