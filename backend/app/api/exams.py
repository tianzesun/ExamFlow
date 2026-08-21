from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.schemas.exam import ExamCreate, ExamListResponse, ExamResponse, ExamUpdate
from app.services import exam_service

router = APIRouter(prefix="/api/exams", tags=["exams"])


@router.get("", response_model=ExamListResponse)
def list_exams(
    course_id: UUID | None = None,
    term: str | None = None,
    academic_year: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    exams, total = exam_service.get_exams(
        db,
        course_id=course_id,
        term=term,
        academic_year=academic_year,
        status=status_filter,
        page=page,
        page_size=page_size,
    )
    return ExamListResponse(exams=exams, total=total, page=page, page_size=page_size)


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    data: ExamCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        exam = exam_service.create_exam(db, data, user.id)
        return exam
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    exam = exam_service.get_exam(db, exam_id)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    return exam


@router.patch("/{exam_id}", response_model=ExamResponse)
def update_exam(
    exam_id: UUID,
    data: ExamUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        exam = exam_service.update_exam(db, exam_id, data, user.id)
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
        return exam
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
