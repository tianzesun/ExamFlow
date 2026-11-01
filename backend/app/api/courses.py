from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.course_access import CourseAccess
from app.models.user import User
from app.rate_limit import per_user
from app.schemas.course import CourseCreate, CourseListResponse, CourseResponse, CourseUpdate
from app.services import access_service, course_service
from app.services.access_service import require_course_access
from app.services.roster_service import parse_csv

router = APIRouter(prefix="/api/courses", tags=["courses"], dependencies=[Depends(require_course_access)])


@router.get("", response_model=CourseListResponse)
def list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    courses, total = course_service.get_courses(
        db, skip=(page - 1) * page_size, limit=page_size, course_ids=access_service.visible_course_ids(db, user)
    )
    return CourseListResponse(courses=courses, total=total)


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    data: CourseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        course = course_service.create_course(db, data, user.id)
        return course
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/access/import", dependencies=[Depends(per_user("upload", 30, 600))])
async def import_access(
    file: UploadFile = File(...),
    confirm: bool = Query(False, description="Save the changes; otherwise only report what would happen"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    """Add instructors and TAs to many courses from a CSV with course_code and email columns."""
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The file is too large (2 MB at most)")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Save the file as CSV (UTF-8)") from None
    rows = parse_csv(text)
    columns = set(rows[0]) if rows else set()
    if rows and not ({"course_code", "course"} & columns and "email" in columns):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="The file needs a course_code column and an email column")
    return access_service.import_course_access(db, rows, user, apply=confirm)


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    course = course_service.get_course(db, course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: UUID,
    data: CourseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        course = course_service.update_course(db, course_id, data, user.id)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return course
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        deleted = course_service.delete_course(db, course_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")


# ── People with access ──────────────────────────────────────

class PersonRequest(BaseModel):
    # The address the person signs in with (for UTORid sign-in, their Microsoft account).
    email: str = Field(..., min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    @field_validator("email", mode="before")
    @classmethod
    def _trim(cls, value):
        # Pasted addresses often carry spaces.
        return value.strip() if isinstance(value, str) else value


def _person(access: CourseAccess, users: dict[str, User]) -> dict:
    user = users.get(access.email)
    return {
        "id": str(access.id),
        "email": access.email,
        # Filled in once the person has signed in.
        "display_name": user.display_name if user else None,
        "role": user.role if user else None,
        "added_at": access.created_at.isoformat(),
    }


def _users_by_email(db: Session, emails: list[str]) -> dict[str, User]:
    users = db.query(User).filter(func.lower(User.email).in_(emails)).all() if emails else []
    return {u.email.lower(): u for u in users}


@router.get("/{course_id}/people")
def list_people(
    course_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Instructors and TAs who can see this course. The exam office sees every course anyway."""
    people = access_service.course_people(db, course_id)
    users = _users_by_email(db, [p.email for p in people])
    return {"people": [_person(p, users) for p in people]}


@router.post("/{course_id}/people", status_code=status.HTTP_201_CREATED)
def add_person(
    course_id: UUID,
    data: PersonRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    if not course_service.get_course(db, course_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    email = access_service.normalise_email(data.email)
    access = CourseAccess(course_id=course_id, email=email, added_by=user.id)
    db.add(access)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{email} already has access") from None
    db.add(AuditLog(user_id=user.id, action="COURSE_ACCESS_GRANTED", entity_type="course", entity_id=course_id,
                    new_values={"email": email}))
    db.commit()
    return _person(access, _users_by_email(db, [email]))


@router.delete("/{course_id}/people/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_person(
    course_id: UUID,
    access_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    access = db.query(CourseAccess).filter(CourseAccess.id == access_id, CourseAccess.course_id == course_id).first()
    if not access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.add(AuditLog(user_id=user.id, action="COURSE_ACCESS_REVOKED", entity_type="course", entity_id=course_id,
                    old_values={"email": access.email}))
    db.delete(access)
    db.commit()
