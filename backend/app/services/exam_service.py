from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.course import Course
from app.models.exam import Exam
from app.schemas.exam import ExamCreate, ExamUpdate

VALID_STATUSES = {"DRAFT", "CONFIGURED", "READY", "GENERATED", "COMPLETED", "ARCHIVED"}
STATUS_TRANSITIONS = {
    "DRAFT": {"CONFIGURED", "ARCHIVED"},
    "CONFIGURED": {"READY", "DRAFT", "ARCHIVED"},
    "READY": {"GENERATED", "CONFIGURED", "ARCHIVED"},
    "GENERATED": {"COMPLETED", "READY", "ARCHIVED"},
    "COMPLETED": {"ARCHIVED"},
    "ARCHIVED": set(),
}


def create_exam(db: Session, data: ExamCreate, user_id: UUID) -> Exam:
    course = db.query(Course).filter(Course.id == data.course_id).first()
    if not course:
        raise ValueError("Course not found")

    exam = Exam(
        course_id=course.id,
        course_code=course.course_code,
        course_name=course.course_name,
        exam_name=data.exam_name,
        term=data.term,
        academic_year=data.academic_year,
        exam_date=data.exam_date,
        start_time=data.start_time,
        duration_minutes=data.duration_minutes,
        status="DRAFT",
        created_by=user_id,
    )
    db.add(exam)
    db.flush()

    db.add(AuditLog(
        user_id=user_id,
        action="EXAM_CREATED",
        entity_type="exam",
        entity_id=exam.id,
        new_values={
            "course_code": course.course_code,
            "exam_name": exam.exam_name,
            "term": exam.term,
            "status": exam.status,
        },
    ))
    db.commit()
    db.refresh(exam)
    return exam


def get_exams(
    db: Session,
    course_id: UUID | None = None,
    term: str | None = None,
    academic_year: int | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Exam], int]:
    query = db.query(Exam)

    if course_id:
        query = query.filter(Exam.course_id == course_id)
    if term:
        query = query.filter(Exam.term == term)
    if academic_year:
        query = query.filter(Exam.academic_year == academic_year)
    if status:
        query = query.filter(Exam.status == status)

    total = query.count()
    exams = (
        query
        .order_by(Exam.exam_date.desc(), Exam.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return exams, total


def get_exam(db: Session, exam_id: UUID) -> Exam | None:
    return db.query(Exam).filter(Exam.id == exam_id).first()


def update_exam(db: Session, exam_id: UUID, data: ExamUpdate, user_id: UUID) -> Exam | None:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return None

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data:
        new_status = update_data["status"]
        if new_status not in VALID_STATUSES:
            raise ValueError(f"Invalid status: {new_status}")
        if new_status not in STATUS_TRANSITIONS.get(exam.status, set()):
            raise ValueError(
                f"Cannot transition from {exam.status} to {new_status}. "
                f"Valid transitions: {STATUS_TRANSITIONS.get(exam.status, set())}"
            )

    old_values = {}
    for field, value in update_data.items():
        old_val = getattr(exam, field)
        if old_val != value:
            old_values[field] = str(old_val) if old_val is not None else None
            setattr(exam, field, value)

    if old_values:
        db.add(AuditLog(
            user_id=user_id,
            action="EXAM_STATUS_CHANGED" if "status" in old_values else "EXAM_UPDATED",
            entity_type="exam",
            entity_id=exam.id,
            old_values=old_values,
            new_values={k: str(getattr(exam, k)) for k in old_values},
        ))

    db.commit()
    db.refresh(exam)
    return exam
