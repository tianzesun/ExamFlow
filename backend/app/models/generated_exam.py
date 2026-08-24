import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GeneratedExam(Base):
    __tablename__ = "generated_exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    exam_student_id = Column(UUID(as_uuid=True), ForeignKey("exam_students.id", ondelete="CASCADE"), nullable=False)
    exam_assignment_id = Column(UUID(as_uuid=True), ForeignKey("exam_assignments.id", ondelete="SET NULL"))
    exam_template_id = Column(UUID(as_uuid=True), ForeignKey("exam_templates.id", ondelete="SET NULL"))
    file_name = Column(String(500), nullable=False)
    storage_key = Column(String(1000), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    file_hash = Column(String(128), nullable=False)
    qr_token = Column(String(64), nullable=True, unique=True)
    qr_generated_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), nullable=False, default="GENERATED")
    generation_version = Column(Integer, nullable=False, default=1)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("exam_id", "exam_student_id", "generation_version", name="uq_generated_exam_version"),
    )
