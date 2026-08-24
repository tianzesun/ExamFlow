import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
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
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("exam_id", "exam_student_id", name="uq_exam_exam_student"),
        UniqueConstraint("exam_id", "seat_id", name="uq_exam_seat"),
    )
