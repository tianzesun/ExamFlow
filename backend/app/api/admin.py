"""Administrators: who uses ExamFlow, and what has been done in it (the audit log)."""

from datetime import date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth import require_role
from app.config import get_settings
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.course import Course
from app.models.course_access import CourseAccess
from app.models.exam import Exam
from app.models.room import Room
from app.models.user import User
from app.services import settings_service
from app.services.settings_service import SignInSettings, SignInSettingsError, SystemSettings

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Exam dates and the log's date filter are Toronto days.
LOCAL = ZoneInfo("America/Toronto")

# Groups for filtering the log; an action not listed falls under "other".
CATEGORIES: dict[str, tuple[str, ...]] = {
    "access": ("USER_", "COURSE_ACCESS_"),
    "courses_exams": ("COURSE_CREATED", "COURSE_UPDATED", "COURSE_DELETED", "TIMETABLE_", "EXAM_CREATED",
                      "EXAM_UPDATED", "EXAM_DELETED", "EXAM_STATUS_"),
    "students": ("ROSTER_", "STUDENT_", "ACCOMMODATION_"),
    "seating": ("SEAT", "EXAM_ROOM_"),
    "papers": ("EXAM_TEMPLATE_", "TEMPLATE_DOWNLOADED", "PERSONALIZED_EXAMS_", "PAPER_DOWNLOADED", "PRINT_FILE_",
               "QR_GENERATED"),
    "exam_day": ("ATTENDANCE_", "EXAM_PACKAGE_", "EXAM_DAY_", "QR_VERIF"),
    "rooms": ("ROOM_",),
    "system": ("SYSTEM_",),
}


def category_of(action: str) -> str:
    return next((c for c, prefixes in CATEGORIES.items() if action.startswith(prefixes)), "other")


# ── People ──────────────────────────────────────────────────

class UserUpdate(BaseModel):
    is_active: bool


def _user_dict(u: User, courses: int) -> dict:
    return {
        "id": str(u.id),
        "display_name": u.display_name,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        # Entra and test accounts get a record at their first sign-in.
        "first_signed_in": u.created_at.isoformat(),
        "source": "test account" if not u.external_id.startswith("entra:") else "UTORid",
        "courses": courses,
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_role("ADMIN"))) -> dict:
    """Everyone who has signed in, with how many courses they were added to."""
    users = db.query(User).order_by(func.lower(User.display_name)).all()
    counts = dict(db.query(CourseAccess.email, func.count(CourseAccess.id)).group_by(CourseAccess.email).all())
    return {"users": [_user_dict(u, counts.get((u.email or "").lower(), 0)) for u in users]}


@router.patch("/users/{user_id}")
def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("ADMIN")),
) -> dict:
    """Switch someone off in ExamFlow at once (e.g. a lost laptop), whatever their role in Entra."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id and not data.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't switch off your own account")
    if user.is_active != data.is_active:
        user.is_active = data.is_active
        db.add(AuditLog(
            user_id=admin.id,
            action="USER_ACTIVATED" if data.is_active else "USER_DEACTIVATED",
            entity_type="user",
            entity_id=user.id,
            new_values={"email": user.email},
        ))
        db.commit()
    courses = db.query(func.count(CourseAccess.id)).filter(CourseAccess.email == (user.email or "").lower()).scalar()
    return _user_dict(user, courses or 0)


# ── Settings ────────────────────────────────────────────────

def _settings_response(settings: SystemSettings) -> dict:
    return {"settings": settings.model_dump(mode="json"), "deployment": settings_service.deployment_info()}


@router.get("/settings")
def get_settings_page(db: Session = Depends(get_db), _admin: User = Depends(require_role("ADMIN"))) -> dict:
    """What an administrator can change here, and how the server is set up (read only)."""
    return _settings_response(settings_service.get_system_settings(db))


@router.put("/settings")
def update_settings(
    data: SystemSettings,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("ADMIN")),
) -> dict:
    """Save the settings. They apply from the next sync, new exam or upload; nothing done already changes."""
    return _settings_response(settings_service.update_system_settings(db, data, admin.id))


def _sign_in_response(db: Session) -> dict:
    settings, source = settings_service.get_sign_in_settings(db)
    return {"sign_in": settings.model_dump(mode="json"), "source": source,
            "enabled": bool(settings.tenant_id), "test_accounts": get_settings().dev_auth_enabled}


@router.get("/settings/sign-in")
def get_sign_in_settings(db: Session = Depends(get_db), _admin: User = Depends(require_role("ADMIN"))) -> dict:
    """The Entra app registration UTORid sign-in uses, and whether the environment sets it."""
    return _sign_in_response(db)


@router.put("/settings/sign-in")
def update_sign_in_settings(
    data: SignInSettings,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("ADMIN")),
) -> dict:
    """Save the app registration; it applies to the next sign-in."""
    try:
        settings_service.update_sign_in_settings(db, data, admin.id)
    except SignInSettingsError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from None
    return _sign_in_response(db)


# ── Activity (audit log) ────────────────────────────────────

def _entity_labels(db: Session, entries: list[AuditLog]) -> dict[UUID, str]:
    """Readable names for the exams, courses, rooms and users the entries refer to."""
    ids: dict[str, set[UUID]] = {}
    for e in entries:
        if e.entity_id:
            ids.setdefault(e.entity_type, set()).add(e.entity_id)
    labels: dict[UUID, str] = {}
    if ids.get("exam"):
        for i, code, name in db.query(Exam.id, Exam.course_code, Exam.exam_name).filter(Exam.id.in_(ids["exam"])):
            labels[i] = f"{code} — {name}"
    if ids.get("course"):
        for i, code in db.query(Course.id, Course.course_code).filter(Course.id.in_(ids["course"])):
            labels[i] = code
    if ids.get("room"):
        for i, building, number in db.query(Room.id, Room.building, Room.room_number).filter(Room.id.in_(ids["room"])):
            labels[i] = f"{building} {number}"
    if ids.get("user"):
        for i, name in db.query(User.id, User.display_name).filter(User.id.in_(ids["user"])):
            labels[i] = name
    return labels


@router.get("/activity")
def list_activity(
    category: str | None = Query(None),
    user_id: UUID | None = Query(None),
    day: date | None = Query(None, description="Only this day (Toronto time)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("ADMIN")),
) -> dict:
    """The audit log, newest first."""
    q = db.query(AuditLog)
    if category:
        if category not in CATEGORIES and category != "other":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown category")
        if category == "other":
            known = [p for prefixes in CATEGORIES.values() for p in prefixes]
            for p in known:
                q = q.filter(~AuditLog.action.startswith(p))
        else:
            q = q.filter(or_(*(AuditLog.action.startswith(p) for p in CATEGORIES[category])))
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if day:
        start = datetime.combine(day, time.min, tzinfo=LOCAL)
        q = q.filter(AuditLog.created_at >= start, AuditLog.created_at < start + timedelta(days=1))

    total = q.count()
    entries = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    names = dict(db.query(User.id, User.display_name).filter(
        User.id.in_({e.user_id for e in entries if e.user_id})
    )) if entries else {}
    labels = _entity_labels(db, entries)
    return {
        "entries": [
            {
                "id": str(e.id),
                "at": e.created_at.isoformat(),
                "action": e.action,
                "category": category_of(e.action),
                # No user: done without signing in (e.g. a QR check) or by the system.
                "user": {"id": str(e.user_id), "name": names.get(e.user_id, "Unknown user")} if e.user_id else None,
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id) if e.entity_id else None,
                "entity_label": labels.get(e.entity_id) if e.entity_id else None,
                "old_values": e.old_values,
                "new_values": e.new_values,
            }
            for e in entries
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
