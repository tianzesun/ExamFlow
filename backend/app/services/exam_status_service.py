"""Keep an exam's status in step with the work actually done on it.

DRAFT, CONFIGURED, READY and GENERATED are derived from the roster, rooms,
seating and generated papers, so they can't drift from reality. COMPLETED and
ARCHIVED are set by staff and are never changed automatically.
"""

from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.services import readiness_service

DERIVED_STATUSES = ("DRAFT", "CONFIGURED", "READY", "GENERATED")
MANUAL_STATUSES = ("COMPLETED", "ARCHIVED")


def derive_status(roster_count: int, room_count: int, assigned_count: int, generated_count: int) -> str:
    if roster_count == 0 or room_count == 0:
        return "DRAFT"
    if assigned_count < roster_count:
        return "CONFIGURED"
    if generated_count < assigned_count:
        return "READY"
    return "GENERATED"


def derived_status_for(db: Session, exam_id: UUID) -> str:
    s = readiness_service.get_exam_summary(db, exam_id)
    return derive_status(s["roster_count"], s["room_count"], s["assigned_count"], s["generated_count"])


def sync_exam_status(db: Session, exam_id: UUID, user_id: UUID | None = None) -> Exam | None:
    """Recompute the derived status after the exam's data changed. Commits if it moved."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam or exam.status in MANUAL_STATUSES:
        return exam

    new_status = derived_status_for(db, exam_id)
    if new_status != exam.status:
        old_status = exam.status
        exam.status = new_status
        db.add(AuditLog(
            user_id=user_id,
            action="EXAM_STATUS_AUTO_UPDATED",
            entity_type="exam",
            entity_id=exam.id,
            old_values={"status": old_status},
            new_values={"status": new_status},
        ))
        db.commit()
        db.refresh(exam)
    return exam


READ_ONLY_METHODS = ("GET", "HEAD", "OPTIONS")


def block_writes_to_archived_exam(request: Request, db: Session = Depends(get_db)) -> None:
    """Router dependency: archived exams are final, so refuse any change to their data."""
    exam_id = request.path_params.get("exam_id")
    if request.method in READ_ONLY_METHODS or not exam_id:
        return
    try:
        exam_uuid = UUID(str(exam_id))
    except ValueError:
        return  # let the route's own validation reject it
    status = db.query(Exam.status).filter(Exam.id == exam_uuid).scalar()
    if status == "ARCHIVED":
        raise HTTPException(status_code=409, detail="This exam is archived and can no longer be changed.")
