import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils import utcnow


class GenerationJob(Base):
    """One background run of personalized paper generation, with its progress."""

    __tablename__ = "generation_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="QUEUED")
    total = Column(Integer, nullable=False, default=0)
    done = Column(Integer, nullable=False, default=0)
    generated = Column(Integer, nullable=False, default=0)
    generation_version = Column(Integer, nullable=True)
    error = Column(String(500), nullable=True)
    # False regenerates every paper; True only those missing or out of date.
    only_changed = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')", name="ck_generation_jobs_status"
        ),
        CheckConstraint("done >= 0 AND done <= total", name="ck_generation_jobs_progress"),
        Index("ix_generation_jobs_exam_id_created_at", "exam_id", "created_at"),
        Index("ix_generation_jobs_created_by", "created_by"),
        # At most one queued or running job per exam.
        Index(
            "uq_generation_jobs_active_exam",
            "exam_id",
            unique=True,
            postgresql_where=text("status IN ('QUEUED', 'RUNNING')"),
        ),
    )
