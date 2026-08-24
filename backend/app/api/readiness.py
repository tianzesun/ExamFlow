from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import readiness_service

router = APIRouter(tags=["readiness"])


class CheckResultResponse(BaseModel):
    name: str
    status: str
    message: str
    count: int | None = None
    required: int | None = None


class ReadinessResponse(BaseModel):
    ready: bool
    checks: list[CheckResultResponse]


class ExamSummaryResponse(BaseModel):
    roster_count: int
    assigned_count: int
    unassigned_count: int
    room_count: int
    generated_count: int
    qr_count: int
    has_template: bool
    template_version: int | None


@router.get("/api/exams/{exam_id}/readiness", response_model=ReadinessResponse)
def get_readiness(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = readiness_service.validate_exam_readiness(db, exam_id)
    return ReadinessResponse(
        ready=result.ready,
        checks=[
            CheckResultResponse(
                name=c.name,
                status=c.status,
                message=c.message,
                count=c.count,
                required=c.required,
            )
            for c in result.checks
        ],
    )


@router.get("/api/exams/{exam_id}/summary", response_model=ExamSummaryResponse)
def get_exam_summary(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return readiness_service.get_exam_summary(db, exam_id)
