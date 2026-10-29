import uuid

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils import utcnow


class Exam(Base):
    __tablename__ = "exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    course_code = Column(String(50), nullable=False)
    course_name = Column(String(255))
    exam_name = Column(String(255), nullable=False)
    term = Column(String(50), nullable=False)
    academic_year = Column(Integer, nullable=False)
    exam_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default="DRAFT")
    assignment_seed = Column(String(255))
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT', 'CONFIGURED', 'READY', 'GENERATED', 'COMPLETED', 'ARCHIVED')",
            name="ck_exams_status",
        ),
        CheckConstraint("duration_minutes > 0 AND duration_minutes <= 1440", name="ck_exams_duration"),
        CheckConstraint("academic_year BETWEEN 2000 AND 2100", name="ck_exams_academic_year"),
        Index("ix_exams_status", "status"),
        Index("ix_exams_course_id", "course_id"),
        Index("ix_exams_created_by", "created_by"),
        Index("ix_exams_exam_date", "exam_date"),
    )
