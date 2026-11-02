"""generated_exams.student_name and student_utorid: the student's details printed on the paper

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
"""

from alembic import op
import sqlalchemy as sa

revision = "v2w3x4y5z6a7"
down_revision = "u1v2w3x4y5z6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_exams", sa.Column("student_name", sa.String(255), nullable=True))
    op.add_column("generated_exams", sa.Column("student_utorid", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("generated_exams", "student_utorid")
    op.drop_column("generated_exams", "student_name")
