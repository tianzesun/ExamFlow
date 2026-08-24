"""Phase 9 - Database indexes for production hardening

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-08-24
"""
from alembic import op
import sqlalchemy as sa

revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Indexes for commonly queried columns
    op.create_index("ix_exams_status", "exams", ["status"])
    op.create_index("ix_exams_course_id", "exams", ["course_id"])
    op.create_index("ix_exams_created_by", "exams", ["created_by"])
    op.create_index("ix_exams_exam_date", "exams", ["exam_date"])

    op.create_index("ix_generated_exams_exam_id", "generated_exams", ["exam_id"])
    op.create_index("ix_generated_exams_status", "generated_exams", ["status"])
    op.create_index("ix_generated_exams_qr_token", "generated_exams", ["qr_token"])

    op.create_index("ix_audit_logs_entity_type_entity_id", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.create_index("ix_exam_assignments_exam_id", "exam_assignments", ["exam_id"])
    op.create_index("ix_exam_assignments_seat_id", "exam_assignments", ["seat_id"])

    op.create_index("ix_exam_templates_exam_id", "exam_templates", ["exam_id"])

    op.create_index("ix_documents_exam_id", "documents", ["exam_id"])

    op.create_index("ix_exam_students_exam_id", "exam_students", ["exam_id"])
    op.create_index("ix_exam_students_student_id", "exam_students", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_exam_students_student_id", table_name="exam_students")
    op.drop_index("ix_exam_students_exam_id", table_name="exam_students")
    op.drop_index("ix_documents_exam_id", table_name="documents")
    op.drop_index("ix_exam_templates_exam_id", table_name="exam_templates")
    op.drop_index("ix_exam_assignments_seat_id", table_name="exam_assignments")
    op.drop_index("ix_exam_assignments_exam_id", table_name="exam_assignments")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity_type_entity_id", table_name="audit_logs")
    op.drop_index("ix_generated_exams_qr_token", table_name="generated_exams")
    op.drop_index("ix_generated_exams_status", table_name="generated_exams")
    op.drop_index("ix_generated_exams_exam_id", table_name="generated_exams")
    op.drop_index("ix_exams_exam_date", table_name="exams")
    op.drop_index("ix_exams_created_by", table_name="exams")
    op.drop_index("ix_exams_course_id", table_name="exams")
    op.drop_index("ix_exams_status", table_name="exams")
