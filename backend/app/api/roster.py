from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.student import Student
from app.models.user import User
from app.rate_limit import per_user
from app.schemas.student import (
    AccommodationUpdate,
    AttendanceSummary,
    AttendanceUpdate,
    ExamStudentResponse,
    RosterImportPreview,
    RosterStats,
    StudentDetailsUpdate,
)
from app.services import roster_service
from app.services.access_service import require_exam_access
from app.services.exam_status_service import block_writes_to_archived_exam, sync_exam_status

router = APIRouter(
    prefix="/api/exams/{exam_id}/roster",
    tags=["roster"],
    dependencies=[Depends(require_exam_access), Depends(block_writes_to_archived_exam)],
)


@router.get("", response_model=dict)
def list_roster(
    exam_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    results, total = roster_service.get_roster(db, exam_id, page, page_size)
    seats = roster_service.seats_for(db, [es.id for es, _ in results])
    students = [_roster_entry(es, s, user, seats.get(es.id)) for es, s in results]
    return {"students": [s.model_dump() for s in students], "total": total}


# Accommodation notes can describe a student's health, so only exam office staff see them.
NOTES_ROLES = {"ADMIN", "STAFF"}


def _roster_entry(es, s, user: User, seat: tuple[str, str] | None = None) -> ExamStudentResponse:
    return ExamStudentResponse(
        id=es.id,
        exam_id=es.exam_id,
        student_id=s.id,
        student_number=s.student_number,
        full_name=s.full_name,
        utorid=s.utorid,
        email=s.email,
        attendance_status=es.attendance_status,
        checked_in_at=es.checked_in_at,
        extra_time_minutes=es.extra_time_minutes,
        accommodation_notes=es.accommodation_notes if user.role in NOTES_ROLES else None,
        room=seat[0] if seat else None,
        seat_code=seat[1] if seat else None,
        created_at=es.created_at,
    )


@router.get("/attendance", response_model=AttendanceSummary)
def attendance_summary(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return roster_service.attendance_summary(db, exam_id)


@router.put("/{student_id}/attendance", response_model=ExamStudentResponse)
def set_attendance(
    exam_id: UUID,
    student_id: UUID,
    data: AttendanceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF", "INSTRUCTOR", "TA")),
):
    es = roster_service.set_attendance(db, exam_id, student_id, data.attendance_status, user.id)
    if not es:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found in roster")
    return _roster_entry(es, _student_for(db, es), user, roster_service.seats_for(db, [es.id]).get(es.id))


@router.patch("/{student_id}", response_model=ExamStudentResponse)
def update_student(
    exam_id: UUID,
    student_id: UUID,
    data: StudentDetailsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    """Correct the student's name or UTORid, in every exam they're in."""
    try:
        student = roster_service.update_student(db, exam_id, student_id, data.full_name, data.utorid, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found in roster")
    es = roster_service._get_exam_student(db, exam_id, student_id)
    sync_exam_status(db, exam_id, user.id)
    return _roster_entry(es, student, user, roster_service.seats_for(db, [es.id]).get(es.id))


@router.put("/{student_id}/accommodation", response_model=ExamStudentResponse)
def set_accommodation(
    exam_id: UUID,
    student_id: UUID,
    data: AccommodationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    es = roster_service.set_accommodation(
        db, exam_id, student_id, data.extra_time_minutes, data.accommodation_notes, user.id
    )
    if not es:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found in roster")
    return _roster_entry(es, _student_for(db, es), user, roster_service.seats_for(db, [es.id]).get(es.id))


def _student_for(db: Session, es) -> Student:
    return db.query(Student).filter(Student.id == es.student_id).one()


@router.get("/stats", response_model=RosterStats)
def roster_stats(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models.exam_student import ExamStudent
    total = db.query(ExamStudent).filter(ExamStudent.exam_id == exam_id).count()
    return RosterStats(total_students=total, exam_id=exam_id)


@router.post(
    "/import/preview", response_model=RosterImportPreview, dependencies=[Depends(per_user("upload", 30, 600))]
)
async def preview_import(
    exam_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported",
        )

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded",
        )

    return roster_service.preview_roster_import(db, exam_id, text)


@router.post("/import/confirm", dependencies=[Depends(per_user("upload", 30, 600))])
async def confirm_import(
    exam_id: UUID,
    file: UploadFile = File(...),
    remove_missing: bool = Query(False, description="The file is the whole class list; remove students not in it"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported",
        )

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded",
        )

    result = roster_service.import_roster(db, exam_id, text, user.id, remove_missing=remove_missing)
    sync_exam_status(db, exam_id, user.id)
    return result


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student(
    exam_id: UUID,
    student_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    removed = roster_service.remove_from_roster(db, exam_id, student_id, user.id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found in roster",
        )
    sync_exam_status(db, exam_id, user.id)
