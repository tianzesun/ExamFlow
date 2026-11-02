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


class GeneratedExam(Base):
    __tablename__ = "generated_exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    # Empty once the student is removed from the roster, kept only if the paper was printed so staff are told
    # to take it out of the stack (roster_service.remove_from_roster).
    exam_student_id = Column(UUID(as_uuid=True), ForeignKey("exam_students.id", ondelete="CASCADE"), nullable=True)
    exam_assignment_id = Column(UUID(as_uuid=True), ForeignKey("exam_assignments.id", ondelete="SET NULL"))
    exam_template_id = Column(UUID(as_uuid=True), ForeignKey("exam_templates.id", ondelete="SET NULL"))
    # The seat printed on the paper; once the student moves, the paper is out of date.
    seat_id = Column(UUID(as_uuid=True), ForeignKey("seats.id", ondelete="SET NULL"))
    # When the paper was first included in a print file.
    printed_at = Column(DateTime(timezone=True), nullable=True)
    # When staff confirmed this printed copy was taken out of the stack after it was replaced or went out of date.
    pulled_at = Column(DateTime(timezone=True), nullable=True)
    file_name = Column(String(500), nullable=False)
    storage_key = Column(String(1000), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    file_hash = Column(String(128), nullable=False)
    qr_token = Column(String(64), nullable=True, unique=True)
    qr_generated_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), nullable=False, default="GENERATED")
    generation_version = Column(Integer, nullable=False, default=1)
    # Whether the paper carries a VERSION badge. Unknown (NULL) for papers made before this was recorded.
    version_shown = Column(Boolean, nullable=True)
    # What the stamp showed (settings_service.PaperStamp.fingerprint); empty on papers made before it was recorded,
    # which used the default.
    stamp_style = Column(String(50), nullable=True)
    # The "course — exam name" line printed at the top, so renaming the exam dates the paper. Empty on papers
    # made before it was recorded.
    exam_title = Column(String(310), nullable=True)
    # The "building room" printed in the stamp, so renaming the room dates the paper. Empty on papers made
    # before it was recorded.
    room_label = Column(String(160), nullable=True)
    # The student's name and UTORid as printed, so correcting them dates the paper. Empty when the stamp
    # doesn't print them (Admin › Settings) or on papers made before they were recorded; student_utorid
    # is "" when the stamp prints UTORids but the student had none.
    student_name = Column(String(255), nullable=True)
    student_utorid = Column(String(50), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("exam_id", "exam_student_id", "generation_version", name="uq_generated_exam_version"),
        CheckConstraint("status IN ('GENERATED', 'SUPERSEDED', 'FAILED')", name="ck_generated_exams_status"),
        CheckConstraint("generation_version >= 1", name="ck_generated_exams_version"),
        Index("ix_generated_exams_status", "status"),
        Index("ix_generated_exams_exam_student_id", "exam_student_id"),
        Index("ix_generated_exams_exam_assignment_id", "exam_assignment_id"),
        Index("ix_generated_exams_exam_template_id", "exam_template_id"),
        Index("ix_generated_exams_seat_id", "seat_id"),
    )
