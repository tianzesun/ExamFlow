import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils import utcnow


class CourseAccess(Base):
    """An instructor or TA who may see a course, its exams and their students.

    Granted by sign-in email, so access can be set up before the person first signs in.
    ADMIN and STAFF see every course and need no entry.
    """

    __tablename__ = "course_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    # Lower-case; matched against the signed-in user's email.
    email = Column(String(255), nullable=False)
    added_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        UniqueConstraint("course_id", "email", name="uq_course_access_email"),
        Index("ix_course_access_email", "email"),
    )
