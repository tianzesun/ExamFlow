from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import access_service, readiness_service
from app.services.access_service import require_exam_access

router = APIRouter(tags=["readiness"], dependencies=[Depends(require_exam_access)])


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


class ExamSummariesRequest(BaseModel):
    exam_ids: list[UUID] = Field(..., max_length=1000)


@router.post("/api/exams/summaries", response_model=dict[str, ExamSummaryResponse])
def get_exam_summaries(
    data: ExamSummariesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Summaries for many exams in one request (the dashboard and exam list)."""
    return readiness_service.get_exam_summaries(db, access_service.visible_exam_ids(db, user, data.exam_ids))


@router.get("/api/exams/{exam_id}/summary", response_model=ExamSummaryResponse)
def get_exam_summary(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return readiness_service.get_exam_summary(db, exam_id)
