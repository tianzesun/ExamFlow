from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.schemas.student import ExamStudentResponse, RosterImportPreview, RosterStats
from app.services import roster_service

router = APIRouter(prefix="/api/exams/{exam_id}/roster", tags=["roster"])


@router.get("", response_model=dict)
def list_roster(
    exam_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    results, total = roster_service.get_roster(db, exam_id, page, page_size)
    students = [
        ExamStudentResponse(
            id=es.id,
            exam_id=es.exam_id,
            student_id=s.id,
            student_number=s.student_number,
            full_name=s.full_name,
            created_at=es.created_at,
        )
        for es, s in results
    ]
    return {"students": [s.model_dump() for s in students], "total": total}


@router.get("/stats", response_model=RosterStats)
def roster_stats(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models.exam_student import ExamStudent
    total = db.query(ExamStudent).filter(ExamStudent.exam_id == exam_id).count()
    return RosterStats(total_students=total, exam_id=exam_id)


@router.post("/import/preview", response_model=RosterImportPreview)
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


@router.post("/import/confirm")
async def confirm_import(
    exam_id: UUID,
    file: UploadFile = File(...),
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

    return roster_service.import_roster(db, exam_id, text, user.id)


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
