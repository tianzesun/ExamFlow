"""generated_exams.pulled_at, and keep printed papers of students removed from the roster

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
"""

from alembic import op
import sqlalchemy as sa

revision = "u1v2w3x4y5z6"
down_revision = "t0u1v2w3x4y5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_exams", sa.Column("pulled_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("generated_exams", "exam_student_id", nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM generated_exams WHERE exam_student_id IS NULL")
    op.alter_column("generated_exams", "exam_student_id", nullable=False)
    op.drop_column("generated_exams", "pulled_at")
