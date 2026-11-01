"""course_access: instructors and TAs who may see a course

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "p6q7r8s9t0u1"
down_revision = "o5p6q7r8s9t0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "course_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("added_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("course_id", "email", name="uq_course_access_email"),
    )
    op.create_index("ix_course_access_email", "course_access", ["email"])


def downgrade() -> None:
    op.drop_index("ix_course_access_email", table_name="course_access")
    op.drop_table("course_access")
