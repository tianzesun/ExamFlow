import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils import utcnow


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    exam_student_id = Column(UUID(as_uuid=True), ForeignKey("exam_students.id", ondelete="CASCADE"), nullable=False)
    seat_id = Column(UUID(as_uuid=True), ForeignKey("seats.id"), nullable=False)
    assignment_method = Column(String(50), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    # Paper version (A–D) this student writes, chosen from the seat so neighbours differ.
    paper_version = Column(String(1), nullable=False, default="A", server_default="A")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint("paper_version IN ('A', 'B', 'C', 'D')", name="ck_exam_assignments_paper_version"),
        UniqueConstraint("exam_id", "exam_student_id", name="uq_exam_exam_student"),
        UniqueConstraint("exam_id", "seat_id", name="uq_exam_seat"),
        CheckConstraint("assignment_method IN ('AUTOMATIC', 'MANUAL')", name="ck_exam_assignments_method"),
        Index("ix_exam_assignments_seat_id", "seat_id"),
        Index("ix_exam_assignments_exam_student_id", "exam_student_id"),
    )
