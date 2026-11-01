import os
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.generated_exam import GeneratedExam
from app.models.user import User
from app.rate_limit import per_user
from app.services import generation_job_service, paper_state, pdf_service
from app.services.access_service import require_exam_access
from app.services.download_audit import record_download
from app.services.exam_status_service import block_writes_to_archived_exam, sync_exam_status
from app.utils import attachment_headers

router = APIRouter(
    tags=["generated-exams"],
    dependencies=[Depends(require_exam_access), Depends(block_writes_to_archived_exam)],
)


class GeneratedExamListResponse(BaseModel):
    exams: list[dict]
    total: int
    page: int
    page_size: int


class GenerationResultResponse(BaseModel):
    generated: int
    failed: int
    generation_version: int



def _verify_generated_ownership(db: Session, generated_exam_id: UUID, exam_id: UUID) -> GeneratedExam:
    ge = pdf_service.get_generated_exam(db, generated_exam_id)
    if not ge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated exam not found")
    if str(ge.exam_id) != str(exam_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return ge


# ── Validate ────────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/generated/validate")
def validate_generation(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    errors = pdf_service.validate_generation(db, exam_id)
    warnings = [] if errors else pdf_service.generation_warnings(db, exam_id)
    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}


# ── Generate ────────────────────────────────────────────────

@router.post(
    "/api/exams/{exam_id}/generated",
    response_model=GenerationResultResponse,
    dependencies=[Depends(per_user("generation", 20, 600))],
)
def generate_exams(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    if generation_job_service.has_active_job(db, exam_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Papers are already being generated for this exam")
    try:
        result = pdf_service.generate_all_exams(db, exam_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    sync_exam_status(db, exam_id, user.id)

    return GenerationResultResponse(
        generated=result["generated"],
        failed=result["failed"],
        generation_version=result["generation_version"],
    )


# ── Background generation ───────────────────────────────────

@router.post(
    "/api/exams/{exam_id}/generated/jobs",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(per_user("generation", 20, 600))],
)
def start_generation_job(
    exam_id: UUID,
    background_tasks: BackgroundTasks,
    only_changed: bool = Query(True, description="Only make papers that are missing or out of date"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        job = generation_job_service.start_job(db, exam_id, user.id, only_changed=only_changed)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    background_tasks.add_task(generation_job_service.run_job, job.id)
    return generation_job_service.to_dict(job)


@router.get("/api/exams/{exam_id}/generated/jobs/latest")
def get_latest_generation_job(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    job = generation_job_service.get_latest_job(db, exam_id)
    return {"job": generation_job_service.to_dict(job) if job else None}


# ── List ────────────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/generated", response_model=GeneratedExamListResponse)
def list_generated(
    exam_id: UUID,
    query: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    outdated_only: bool = Query(False),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    exams, total = pdf_service.get_generated_exams(
        db, exam_id, query=query, page=page, page_size=page_size, outdated_only=outdated_only
    )
    return GeneratedExamListResponse(
        exams=exams, total=total, page=page, page_size=page_size
    )


@router.get("/api/exams/{exam_id}/generated/status")
def get_paper_status(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """How many papers are up to date, need generating again, or haven't been printed yet."""
    return paper_state.paper_counts(db, exam_id)


# ── Preview ─────────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/generated/preview", dependencies=[Depends(per_user("exam-files", 30, 600))])
def preview_paper(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """The template stamped for a sample student; shown inline so it opens in the browser."""
    try:
        data = pdf_service.preview_paper(db, exam_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": 'inline; filename="paper-preview.pdf"'})


# ── Print file ──────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/generated/print", dependencies=[Depends(per_user("exam-files", 30, 600))])
def download_print_file(
    exam_id: UUID,
    room_id: UUID | None = Query(None),
    double_sided: bool = Query(False),
    only_new: bool = Query(False, description="Leave out papers already sent to print"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    """Every up-to-date paper in one PDF, in seat order, for printing."""
    try:
        data, filename = pdf_service.build_print_file(db, exam_id, user.id, room_id, double_sided, only_new)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return Response(content=data, media_type="application/pdf", headers=attachment_headers(filename))


# ── Download ────────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/generated/{generated_exam_id}/download")
def download_generated(
    exam_id: UUID,
    generated_exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ge = _verify_generated_ownership(db, generated_exam_id, exam_id)

    filepath = ge.storage_key
    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    record_download(db, user, "PAPER_DOWNLOADED", exam_id, file_name=ge.file_name,
                    generation_version=ge.generation_version)

    def iterfile():
        with open(filepath, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers=attachment_headers(ge.file_name),
    )
