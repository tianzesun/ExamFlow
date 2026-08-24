import uuid

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils import utcnow


class ExamTemplate(Base):
    __tablename__ = "exam_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    file_hash = Column(String(128), nullable=False)
    template_type = Column(String(50), nullable=False, default="CROWDMARK_EXPORT")
    version = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    crowdmark_exam_id = Column(String(255))
    crowdmark_url = Column(String(1000))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("exam_id", "version", name="uq_exam_template_version"),
    )
