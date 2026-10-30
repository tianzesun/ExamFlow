"""generation jobs: background paper generation with progress

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "generation_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("exam_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("exams.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("done", sa.Integer(), nullable=False),
        sa.Column("generated", sa.Integer(), nullable=False),
        sa.Column("generation_version", sa.Integer(), nullable=True),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')",
                           name="ck_generation_jobs_status"),
        sa.CheckConstraint("done >= 0 AND done <= total", name="ck_generation_jobs_progress"),
    )
    op.create_index("ix_generation_jobs_exam_id_created_at", "generation_jobs", ["exam_id", "created_at"])
    op.create_index("ix_generation_jobs_created_by", "generation_jobs", ["created_by"])
    op.create_index(
        "uq_generation_jobs_active_exam", "generation_jobs", ["exam_id"], unique=True,
        postgresql_where=sa.text("status IN ('QUEUED', 'RUNNING')"),
    )


def downgrade() -> None:
    op.drop_index("uq_generation_jobs_active_exam", table_name="generation_jobs")
    op.drop_index("ix_generation_jobs_created_by", table_name="generation_jobs")
    op.drop_index("ix_generation_jobs_exam_id_created_at", table_name="generation_jobs")
    op.drop_table("generation_jobs")
