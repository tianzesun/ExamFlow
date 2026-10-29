"""complete schema: integrity constraints, index cleanup, attendance and accommodations

- CHECK constraints on every status/enum column and on numeric ranges.
- Drops indexes duplicated by another index or by a unique constraint's leading
  column, renames the old idx_* indexes to the ix_* convention and adds the
  missing foreign-key indexes, so models and database now match (alembic check).
- students: optional UTORid and email from the roster import.
- exam_students: exam-day attendance and per-exam accommodations.
- exams: notes for invigilators.
- generated_exams: earlier generations are marked SUPERSEDED.

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None

REDUNDANT_INDEXES = [
    ("idx_courses_course_code", "courses"),            # courses_course_code_key
    ("idx_exams_course_id", "exams"),                  # ix_exams_course_id
    ("ix_exam_students_exam_id", "exam_students"),     # uq_exam_student
    ("ix_exam_assignments_exam_id", "exam_assignments"),  # uq_exam_exam_student
    ("idx_exam_rooms_exam_id", "exam_rooms"),          # uq_exam_room
    ("idx_exam_templates_exam_id", "exam_templates"),  # uq_exam_template_version
    ("ix_exam_templates_exam_id", "exam_templates"),   # uq_exam_template_version
    ("idx_generated_exams_exam_id", "generated_exams"),  # uq_generated_exam_version
    ("ix_generated_exams_exam_id", "generated_exams"),   # uq_generated_exam_version
    ("ix_generated_exams_qr_token", "generated_exams"),  # generated_exams_qr_token_key
]

RENAMED_INDEXES = [
    ("idx_exam_rooms_room_id", "ix_exam_rooms_room_id"),
    ("idx_exam_templates_file_hash", "ix_exam_templates_file_hash"),
    ("idx_generated_exams_exam_student_id", "ix_generated_exams_exam_student_id"),
]

NEW_INDEXES = [
    ("ix_exam_assignments_exam_student_id", "exam_assignments", ["exam_student_id"]),
    ("ix_generated_exams_exam_assignment_id", "generated_exams", ["exam_assignment_id"]),
    ("ix_generated_exams_exam_template_id", "generated_exams", ["exam_template_id"]),
]

CHECKS = [
    ("ck_exams_status", "exams",
     "status IN ('DRAFT', 'CONFIGURED', 'READY', 'GENERATED', 'COMPLETED', 'ARCHIVED')"),
    ("ck_exams_duration", "exams", "duration_minutes > 0 AND duration_minutes <= 1440"),
    ("ck_exams_academic_year", "exams", "academic_year BETWEEN 2000 AND 2100"),
    ("ck_exam_students_attendance", "exam_students", "attendance_status IN ('EXPECTED', 'PRESENT', 'ABSENT')"),
    ("ck_exam_students_extra_time", "exam_students", "extra_time_minutes BETWEEN 0 AND 1440"),
    ("ck_exam_assignments_method", "exam_assignments", "assignment_method IN ('AUTOMATIC', 'MANUAL')"),
    ("ck_exam_templates_version", "exam_templates", "version >= 1"),
    ("ck_exam_templates_file_size", "exam_templates", "file_size >= 0"),
    ("ck_generated_exams_status", "generated_exams", "status IN ('GENERATED', 'SUPERSEDED', 'FAILED')"),
    ("ck_generated_exams_version", "generated_exams", "generation_version >= 1"),
    ("ck_rooms_capacity", "rooms", "capacity >= 0"),
    ("ck_seats_status", "seats", "status IN ('AVAILABLE', 'BLOCKED', 'RESERVED')"),
    ("ck_users_role", "users", "role IN ('ADMIN', 'STAFF', 'INSTRUCTOR', 'TA')"),
]


def upgrade() -> None:
    for name, table in REDUNDANT_INDEXES:
        op.drop_index(name, table_name=table, if_exists=True)
    for old, new in RENAMED_INDEXES:
        op.execute(f"ALTER INDEX IF EXISTS {old} RENAME TO {new}")
    for name, table, cols in NEW_INDEXES:
        op.create_index(name, table, cols)

    op.add_column("students", sa.Column("utorid", sa.String(50), nullable=True))
    op.add_column("students", sa.Column("email", sa.String(255), nullable=True))
    op.create_unique_constraint("students_utorid_key", "students", ["utorid"])

    op.add_column("exam_students", sa.Column(
        "attendance_status", sa.String(20), nullable=False, server_default="EXPECTED"))
    op.add_column("exam_students", sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("exam_students", sa.Column(
        "checked_in_by", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("exam_students", sa.Column(
        "extra_time_minutes", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("exam_students", sa.Column("accommodation_notes", sa.Text(), nullable=True))
    op.add_column("exam_students", sa.Column(
        "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))

    op.add_column("exams", sa.Column("notes", sa.Text(), nullable=True))

    # Only the newest generation of each exam stays current.
    op.execute(
        """
        UPDATE generated_exams g SET status = 'SUPERSEDED'
        WHERE g.status = 'GENERATED' AND g.generation_version < (
            SELECT max(generation_version) FROM generated_exams m WHERE m.exam_id = g.exam_id
        )
        """
    )

    for name, table, cond in CHECKS:
        op.create_check_constraint(name, table, cond)


def downgrade() -> None:
    for name, table, _ in reversed(CHECKS):
        op.drop_constraint(name, table, type_="check")
    op.execute("UPDATE generated_exams SET status = 'GENERATED' WHERE status = 'SUPERSEDED'")

    op.drop_column("exams", "notes")
    for col in ("updated_at", "accommodation_notes", "extra_time_minutes", "checked_in_by",
                "checked_in_at", "attendance_status"):
        op.drop_column("exam_students", col)
    op.drop_constraint("students_utorid_key", "students", type_="unique")
    op.drop_column("students", "email")
    op.drop_column("students", "utorid")

    for name, table, _ in NEW_INDEXES:
        op.drop_index(name, table_name=table)
    for old, new in RENAMED_INDEXES:
        op.execute(f"ALTER INDEX IF EXISTS {new} RENAME TO {old}")
    op.create_index("idx_courses_course_code", "courses", ["course_code"])
    op.create_index("idx_exams_course_id", "exams", ["course_id"])
    op.create_index("ix_exam_students_exam_id", "exam_students", ["exam_id"])
    op.create_index("ix_exam_assignments_exam_id", "exam_assignments", ["exam_id"])
    op.create_index("idx_exam_rooms_exam_id", "exam_rooms", ["exam_id"])
    op.create_index("ix_exam_templates_exam_id", "exam_templates", ["exam_id"])
    op.create_index("ix_generated_exams_exam_id", "generated_exams", ["exam_id"])
