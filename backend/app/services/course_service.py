from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.course import Course
from app.models.exam import Exam
from app.models.meeting import Meeting
from app.schemas.course import CourseCreate, CourseUpdate


def create_course(db: Session, data: CourseCreate, user_id: UUID) -> Course:
    existing = db.query(Course).filter(Course.course_code == data.course_code).first()
    if existing:
        raise ValueError(f"Course with code '{data.course_code}' already exists")

    course = Course(
        course_code=data.course_code,
        course_name=data.course_name,
        department=data.department,
    )
    db.add(course)
    db.flush()

    db.add(AuditLog(
        user_id=user_id,
        action="COURSE_CREATED",
        entity_type="course",
        entity_id=course.id,
        new_values={"course_code": course.course_code, "course_name": course.course_name},
    ))
    db.commit()
    db.refresh(course)
    return course


def get_courses(
    db: Session, skip: int = 0, limit: int = 50, course_ids: set[UUID] | None = None
) -> tuple[list[Course], int]:
    """course_ids limits the list to those courses (None: every course)."""
    query = db.query(Course)
    if course_ids is not None:
        query = query.filter(Course.id.in_(course_ids))
    total = query.with_entities(func.count(Course.id)).scalar()
    courses = query.order_by(Course.course_code).offset(skip).limit(limit).all()
    return courses, total


def get_course(db: Session, course_id: UUID) -> Course | None:
    return db.query(Course).filter(Course.id == course_id).first()


def update_course(db: Session, course_id: UUID, data: CourseUpdate, user_id: UUID) -> Course | None:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return None

    old_values = {}
    update_data = data.model_dump(exclude_unset=True)

    if "course_code" in update_data and update_data["course_code"] != course.course_code:
        existing = db.query(Course).filter(
            Course.course_code == update_data["course_code"],
            Course.id != course_id,
        ).first()
        if existing:
            raise ValueError(f"Course with code '{update_data['course_code']}' already exists")
        old_values["course_code"] = course.course_code

    if "course_name" in update_data and update_data["course_name"] != course.course_name:
        old_values["course_name"] = course.course_name

    for field, value in update_data.items():
        setattr(course, field, value)
    # Exams keep a copy of the code and name (they're stamped on papers); archived exams stay as they were.
    renamed = {f: update_data[f] for f in ("course_code", "course_name") if f in old_values}
    if renamed:
        db.query(Exam).filter(Exam.course_id == course_id, Exam.status != "ARCHIVED").update(
            renamed, synchronize_session=False
        )

    if old_values:
        db.add(AuditLog(
            user_id=user_id,
            action="COURSE_UPDATED",
            entity_type="course",
            entity_id=course.id,
            old_values=old_values,
            new_values={k: v for k, v in update_data.items() if k in old_values},
        ))

    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, course_id: UUID, user_id: UUID) -> bool:
    """Delete a course that has no exams. Its timetable meetings go with it."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return False
    exam_count = db.query(func.count(Exam.id)).filter(Exam.course_id == course_id).scalar() or 0
    if exam_count:
        raise ValueError(f"This course has {exam_count} exam(s). Delete or move them first.")

    db.query(Meeting).filter(Meeting.course_id == course_id).delete(synchronize_session=False)
    db.add(AuditLog(
        user_id=user_id,
        action="COURSE_DELETED",
        entity_type="course",
        entity_id=course.id,
        old_values={"course_code": course.course_code, "course_name": course.course_name},
    ))
    db.delete(course)
    db.commit()
    return True
