"""generated papers remember their seat and when they were printed; jobs can update only changed papers

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_exams", sa.Column("seat_id", postgresql.UUID(as_uuid=True),
                                               sa.ForeignKey("seats.id", ondelete="SET NULL"), nullable=True))
    op.add_column("generated_exams", sa.Column("printed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_generated_exams_seat_id", "generated_exams", ["seat_id"])
    # Existing papers were stamped with their assignment's seat at the time; the best record left is
    # the assignment's current seat.
    op.execute(
        "UPDATE generated_exams ge SET seat_id = ea.seat_id "
        "FROM exam_assignments ea WHERE ea.id = ge.exam_assignment_id"
    )
    op.add_column("generation_jobs", sa.Column("only_changed", sa.Boolean(), nullable=False,
                                               server_default=sa.true()))
    op.alter_column("generation_jobs", "only_changed", server_default=None)


def downgrade() -> None:
    op.drop_column("generation_jobs", "only_changed")
    op.drop_index("ix_generated_exams_seat_id", table_name="generated_exams")
    op.drop_column("generated_exams", "printed_at")
    op.drop_column("generated_exams", "seat_id")
