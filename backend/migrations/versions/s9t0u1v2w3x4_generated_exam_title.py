"""generated_exams.exam_title: the exam title printed on the paper

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
"""

from alembic import op
import sqlalchemy as sa

revision = "s9t0u1v2w3x4"
down_revision = "r8s9t0u1v2w3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_exams", sa.Column("exam_title", sa.String(310), nullable=True))


def downgrade() -> None:
    op.drop_column("generated_exams", "exam_title")
