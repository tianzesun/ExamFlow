import os
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.services import template_service

router = APIRouter(tags=["templates"])


class TemplateResponse(BaseModel):
    id: str
    exam_id: str
    original_filename: str
    mime_type: str
    file_size: int
    file_hash: str
    template_type: str
    version: int
    is_active: bool
    crowdmark_exam_id: str | None
    crowdmark_url: str | None
    created_at: str | None


# ── Upload ──────────────────────────────────────────────────

@router.post("/api/exams/{exam_id}/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def upload_template(
    exam_id: UUID,
    file: UploadFile = File(...),
    crowdmark_exam_id: str | None = Form(None),
    crowdmark_url: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    content = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    try:
        template = template_service.upload_template(
            db, exam_id, file.filename or "unnamed.pdf", content, mime_type,
            user.id, crowdmark_exam_id=crowdmark_exam_id, crowdmark_url=crowdmark_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return TemplateResponse(
        id=str(template.id),
        exam_id=str(template.exam_id),
        original_filename=template.original_filename,
        mime_type=template.mime_type,
        file_size=template.file_size,
        file_hash=template.file_hash,
        template_type=template.template_type,
        version=template.version,
        is_active=template.is_active,
        crowdmark_exam_id=template.crowdmark_exam_id,
        crowdmark_url=template.crowdmark_url,
        created_at=template.created_at.isoformat() if template.created_at else None,
    )


# ── List ────────────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/templates", response_model=list[TemplateResponse])
def list_templates(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    templates = template_service.list_templates(db, exam_id)
    return [
        TemplateResponse(
            id=str(t.id),
            exam_id=str(t.exam_id),
            original_filename=t.original_filename,
            mime_type=t.mime_type,
            file_size=t.file_size,
            file_hash=t.file_hash,
            template_type=t.template_type,
            version=t.version,
            is_active=t.is_active,
            crowdmark_exam_id=t.crowdmark_exam_id,
            crowdmark_url=t.crowdmark_url,
            created_at=t.created_at.isoformat() if t.created_at else None,
        )
        for t in templates
    ]


# ── Download ────────────────────────────────────────────────

@router.get("/api/exam-templates/{template_id}/download")
def download_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    template = template_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    filepath = template_service.get_template_path(template)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template file not found")

    def iterfile():
        with open(filepath, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{template.original_filename}"'},
    )


# ── Activate ────────────────────────────────────────────────

@router.post("/api/exam-templates/{template_id}/activate", response_model=TemplateResponse)
def activate_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        template = template_service.activate_template(db, template_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return TemplateResponse(
        id=str(template.id),
        exam_id=str(template.exam_id),
        original_filename=template.original_filename,
        mime_type=template.mime_type,
        file_size=template.file_size,
        file_hash=template.file_hash,
        template_type=template.template_type,
        version=template.version,
        is_active=template.is_active,
        crowdmark_exam_id=template.crowdmark_exam_id,
        crowdmark_url=template.crowdmark_url,
        created_at=template.created_at.isoformat() if template.created_at else None,
    )


# ── Archive ─────────────────────────────────────────────────

@router.post("/api/exam-templates/{template_id}/archive", response_model=TemplateResponse)
def archive_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        template = template_service.archive_template(db, template_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return TemplateResponse(
        id=str(template.id),
        exam_id=str(template.exam_id),
        original_filename=template.original_filename,
        mime_type=template.mime_type,
        file_size=template.file_size,
        file_hash=template.file_hash,
        template_type=template.template_type,
        version=template.version,
        is_active=template.is_active,
        crowdmark_exam_id=template.crowdmark_exam_id,
        crowdmark_url=template.crowdmark_url,
        created_at=template.created_at.isoformat() if template.created_at else None,
    )
