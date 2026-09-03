"""Phase 10 - Add meetings table for TTB integration

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "g7h8i9j0k1l2"
down_revision = "f6g7h8i9j0k1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meetings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", UUID(as_uuid=True), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("section_code", sa.String(20), nullable=False),
        sa.Column("semester", sa.String(20), nullable=False),
        sa.Column("day", sa.String(10)),
        sa.Column("start_time", sa.String(10)),
        sa.Column("end_time", sa.String(10)),
        sa.Column("building", sa.String(100)),
        sa.Column("room", sa.String(50)),
        sa.Column("instructors", sa.String(500)),
        sa.Column("max_capacity", sa.Integer, default=0),
        sa.Column("current_enrolment", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_meetings_course_id", "meetings", ["course_id"])
    op.create_index("ix_meetings_semester", "meetings", ["semester"])
    op.create_index("ix_meetings_section_code", "meetings", ["section_code"])


def downgrade() -> None:
    op.drop_index("ix_meetings_section_code", table_name="meetings")
    op.drop_index("ix_meetings_semester", table_name="meetings")
    op.drop_index("ix_meetings_course_id", table_name="meetings")
    op.drop_table("meetings")
