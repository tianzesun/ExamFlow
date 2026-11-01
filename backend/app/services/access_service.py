"""Who may see which courses and exams.

ADMIN and STAFF (the exam office) see everything. Instructors and TAs see only the courses
they were added to, with those courses' exams, rosters, seating and papers. An exam or course
someone may not see answers "not found", so its existence isn't revealed either.
"""

import re
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from app.auth import get_current_user, security
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.course import Course
from app.models.course_access import CourseAccess
from app.models.exam import Exam
from app.models.user import User

SEES_ALL = frozenset({"ADMIN", "STAFF"})


def visible_course_ids(db: Session, user: User) -> set[UUID] | None:
    """Courses the user may see, or None for all of them."""
    if user.role in SEES_ALL:
        return None
    if not user.email:
        return set()
    rows = db.query(CourseAccess.course_id).filter(CourseAccess.email == user.email.strip().lower())
    return {course_id for (course_id,) in rows}


def limit_to_visible(query: Query, column, db: Session, user: User) -> Query:
    """Narrow a query to rows whose course (via `column`) the user may see."""
    ids = visible_course_ids(db, user)
    return query if ids is None else query.filter(column.in_(ids))


def can_see_course(db: Session, user: User, course_id: UUID) -> bool:
    ids = visible_course_ids(db, user)
    return ids is None or course_id in ids


def can_see_exam(db: Session, user: User, exam_id: UUID) -> bool:
    if user.role in SEES_ALL:
        return True
    course_id = db.query(Exam.course_id).filter(Exam.id == exam_id).scalar()
    return course_id is not None and can_see_course(db, user, course_id)


def visible_exam_ids(db: Session, user: User, exam_ids: list[UUID]) -> list[UUID]:
    ids = visible_course_ids(db, user)
    if ids is None:
        return exam_ids
    allowed = {e for (e,) in db.query(Exam.id).filter(Exam.id.in_(exam_ids), Exam.course_id.in_(ids))}
    return [e for e in exam_ids if e in allowed]


def _path_uuid(request: Request, name: str) -> UUID | None:
    value = request.path_params.get(name)
    if value is None:
        return None
    try:
        return UUID(str(value))
    except ValueError:
        return None  # the route's own validation rejects it


def require_exam_access(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> None:
    """Router dependency for routes under /api/exams/{exam_id}. Routes without an exam id
    (such as the public QR check) pass straight through, without needing a sign-in."""
    exam_id = _path_uuid(request, "exam_id")
    if exam_id is None:
        return
    user = get_current_user(credentials, db)
    if not can_see_exam(db, user, exam_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")


def require_course_access(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> None:
    course_id = _path_uuid(request, "course_id")
    if course_id is None:
        return
    user = get_current_user(credentials, db)
    if not can_see_course(db, user, course_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")


def normalise_email(email: str) -> str:
    return email.strip().lower()


def course_people(db: Session, course_id: UUID) -> list[CourseAccess]:
    return (
        db.query(CourseAccess).filter(CourseAccess.course_id == course_id)
        .order_by(func.lower(CourseAccess.email)).all()
    )


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _course_key(code: str) -> str:
    """Course codes are typed as "CSC 108", "csc108" or "CSC108"; compare without case or spaces."""
    return re.sub(r"\s+", "", code).upper()


def import_course_access(db: Session, rows: list[dict], user: User, apply: bool) -> dict:
    """Give many people access from rows of course_code and email.

    With apply=False nothing is saved: the result says what would happen, row by row.
    """
    courses = {_course_key(c.course_code): c for c in db.query(Course)}
    existing = {(course_id, email) for course_id, email in db.query(CourseAccess.course_id, CourseAccess.email)}
    added, already, errors, seen = [], 0, [], set()
    for line, row in enumerate(rows, start=2):  # row 1 is the header
        code = (row.get("course_code") or row.get("course") or "").strip()
        email = normalise_email(row.get("email") or "")
        if not code and not email:
            continue
        course = courses.get(_course_key(code))
        if not course:
            errors.append(f"Row {line}: no course {code or '(blank)'}")
            continue
        if not EMAIL_PATTERN.match(email) or len(email) > 255:
            errors.append(f"Row {line}: {email or '(blank)'} isn't an email address")
            continue
        key = (course.id, email)
        if key in existing or key in seen:
            already += 1
            continue
        seen.add(key)
        added.append({"course_code": course.course_code, "email": email})
        if apply:
            db.add(CourseAccess(course_id=course.id, email=email, added_by=user.id))
            db.add(AuditLog(user_id=user.id, action="COURSE_ACCESS_GRANTED", entity_type="course",
                            entity_id=course.id, new_values={"email": email, "source": "csv"}))
    if apply:
        db.commit()
    return {"added": len(added), "already": already, "errors": errors, "rows": added[:20]}
