import os
import shutil
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.course import Course
from app.models.exam import Exam
from app.schemas.exam import ExamCreate, ExamUpdate
from app.services import exam_status_service

VALID_STATUSES = {"DRAFT", "CONFIGURED", "READY", "GENERATED", "COMPLETED", "ARCHIVED"}
# Only the manual statuses can be requested directly; DRAFT..GENERATED follow the
# exam's data (see exam_status_service). Requesting a derived status from
# COMPLETED reopens the exam at whatever its data says.
STATUS_TRANSITIONS = {
    "DRAFT": {"ARCHIVED"},
    "CONFIGURED": {"ARCHIVED"},
    "READY": {"COMPLETED", "ARCHIVED"},
    "GENERATED": {"COMPLETED", "ARCHIVED"},
    "COMPLETED": {"ARCHIVED", *exam_status_service.DERIVED_STATUSES},
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
        notes=data.notes or None,
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
    if exam.status == "ARCHIVED" and update_data:
        raise ValueError("This exam is archived and can no longer be changed.")

    if "status" in update_data:
        new_status = update_data["status"]
        if new_status not in VALID_STATUSES:
            raise ValueError(f"Invalid status: {new_status}")
        if new_status not in STATUS_TRANSITIONS.get(exam.status, set()):
            if new_status in exam_status_service.DERIVED_STATUSES and exam.status != "ARCHIVED":
                raise ValueError(
                    f"{new_status} is set automatically from the roster, seating and generated papers"
                )
            raise ValueError(
                f"Cannot transition from {exam.status} to {new_status}. "
                f"Valid transitions: {sorted(STATUS_TRANSITIONS.get(exam.status, set()))}"
            )
        if new_status in exam_status_service.DERIVED_STATUSES:
            update_data["status"] = exam_status_service.derived_status_for(db, exam.id)

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


def delete_exam(db: Session, exam_id: UUID, user_id: UUID) -> bool:
    """Delete an exam with its roster, seating, templates and generated papers (rows cascade)."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return False
    db.add(AuditLog(
        user_id=user_id,
        action="EXAM_DELETED",
        entity_type="exam",
        entity_id=exam.id,
        old_values={"course_code": exam.course_code, "exam_name": exam.exam_name, "status": exam.status},
    ))
    db.delete(exam)
    db.commit()
    # Stored PDFs belong only to this exam; remove them once the rows are gone.
    shutil.rmtree(os.path.join("storage", "exams", str(exam_id)), ignore_errors=True)
    return True
