import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils import utcnow

ATTENDANCE_STATUSES = ("EXPECTED", "PRESENT", "ABSENT")


class ExamStudent(Base):
    __tablename__ = "exam_students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    # Exam-day attendance, recorded by invigilators.
    attendance_status = Column(String(20), nullable=False, default="EXPECTED", server_default="EXPECTED")
    checked_in_at = Column(DateTime(timezone=True))
    checked_in_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    # Accommodations (e.g. extra writing time) granted for this exam only.
    extra_time_minutes = Column(Integer, nullable=False, default=0, server_default="0")
    accommodation_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_exam_student"),
        CheckConstraint("attendance_status IN ('EXPECTED', 'PRESENT', 'ABSENT')", name="ck_exam_students_attendance"),
        CheckConstraint("extra_time_minutes BETWEEN 0 AND 1440", name="ck_exam_students_extra_time"),
        Index("ix_exam_students_student_id", "student_id"),
    )
