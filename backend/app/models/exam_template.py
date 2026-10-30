import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
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
    # Which paper version (A–D) this upload is; each version has its own active template.
    paper_version = Column(String(1), nullable=False, default="A", server_default="A")
    is_active = Column(Boolean, nullable=False, default=True)
    crowdmark_exam_id = Column(String(255))
    crowdmark_url = Column(String(1000))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("exam_id", "version", name="uq_exam_template_version"),
        CheckConstraint("version >= 1", name="ck_exam_templates_version"),
        CheckConstraint("paper_version IN ('A', 'B', 'C', 'D')", name="ck_exam_templates_paper_version"),
        CheckConstraint("file_size >= 0", name="ck_exam_templates_file_size"),
        Index("ix_exam_templates_file_hash", "file_hash"),
    )
