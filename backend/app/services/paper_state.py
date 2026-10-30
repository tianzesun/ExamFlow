"""Which generated papers still match the student's seat and the active template.

A paper stays valid (its QR code verifies) until it is replaced, but it is only
up to date while the student sits in the seat printed on it and the template it
was made from is still the active one. Seating changes and a new template
therefore make just the affected papers out of date, and only those need
generating and printing again.
"""

from uuid import UUID

from sqlalchemy import and_, func, not_, select
from sqlalchemy.orm import Session

from app.models.exam_assignment import ExamAssignment
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam

# Correlated to the paper explicitly, so these still work in queries that also join seats or templates.
_seat_matches = (
    select(ExamAssignment.id)
    .where(
        ExamAssignment.exam_student_id == GeneratedExam.exam_student_id,
        ExamAssignment.seat_id == GeneratedExam.seat_id,
    )
    .correlate(GeneratedExam)
    .exists()
)
_template_active = (
    select(ExamTemplate.id)
    .where(
        ExamTemplate.id == GeneratedExam.exam_template_id,
        ExamTemplate.is_active == True,  # noqa: E712
    )
    .correlate(GeneratedExam)
    .exists()
)

# Filters for a current paper that matches its student's seat and the active template.
UP_TO_DATE = (GeneratedExam.status == "GENERATED", _seat_matches, _template_active)
OUTDATED = (GeneratedExam.status == "GENERATED", not_(and_(_seat_matches, _template_active)))


def up_to_date_student_ids(db: Session, exam_id: UUID) -> set[UUID]:
    """exam_student ids whose current paper needs no changes."""
    rows = db.query(GeneratedExam.exam_student_id).filter(GeneratedExam.exam_id == exam_id, *UP_TO_DATE)
    return {row[0] for row in rows}


def paper_counts(db: Session, exam_id: UUID) -> dict:
    seated = db.query(func.count(ExamAssignment.id)).filter(ExamAssignment.exam_id == exam_id).scalar() or 0

    def count(*filters) -> int:
        return db.query(func.count(GeneratedExam.id)).filter(GeneratedExam.exam_id == exam_id, *filters).scalar() or 0

    up_to_date = count(*UP_TO_DATE)
    outdated = count(*OUTDATED)
    return {
        "seated": seated,
        "up_to_date": up_to_date,
        "outdated": outdated,
        # Seated students without an up-to-date paper, whether theirs is out of date or missing.
        "to_generate": max(0, seated - up_to_date),
        "not_printed": count(*UP_TO_DATE, GeneratedExam.printed_at.is_(None)),
    }
