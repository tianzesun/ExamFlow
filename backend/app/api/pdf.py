import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.services import pdf_service

router = APIRouter(tags=["generated-exams"])


class GenerateRequest(BaseModel):
    pass


class GeneratedExamResponse(BaseModel):
    id: str
    student_number: str
    full_name: str
    file_name: str
    file_size: int
    status: str
    generation_version: int
    template_version: int | None
    created_at: str | None


class GeneratedExamListResponse(BaseModel):
    exams: list[dict]
    total: int
    page: int
    page_size: int


class GenerationResultResponse(BaseModel):
    generated: int
    failed: int
    generation_version: int


# ── Validate ────────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/generated/validate")
def validate_generation(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    errors = pdf_service.validate_generation(db, exam_id)
    return {"valid": len(errors) == 0, "errors": errors}


# ── Generate ────────────────────────────────────────────────

@router.post("/api/exams/{exam_id}/generated", response_model=GenerationResultResponse)
def generate_exams(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        results = pdf_service.generate_all_exams(db, exam_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    generated = sum(1 for r in results if r.status == "GENERATED")
    failed = sum(1 for r in results if r.status == "FAILED")

    return GenerationResultResponse(
        generated=generated,
        failed=failed,
        generation_version=results[0].generated_exam_id is not None and 1 or 1,
    )


# ── List ────────────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/generated", response_model=GeneratedExamListResponse)
def list_generated(
    exam_id: UUID,
    query: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    exams, total = pdf_service.get_generated_exams(
        db, exam_id, query=query, page=page, page_size=page_size
    )
    return GeneratedExamListResponse(
        exams=exams, total=total, page=page, page_size=page_size
    )


# ── Download ────────────────────────────────────────────────

@router.get("/api/generated-exams/{generated_exam_id}/download")
def download_generated(
    generated_exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    ge = pdf_service.get_generated_exam(db, generated_exam_id)
    if not ge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated exam not found")

    filepath = pdf_service.get_generated_exam_path(ge)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    def iterfile():
        with open(filepath, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{ge.file_name}"'},
    )
