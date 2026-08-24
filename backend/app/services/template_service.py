import hashlib
import os
import uuid
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam_template import ExamTemplate

PDF_MIME = "application/pdf"
MAX_TEMPLATE_SIZE = 50 * 1024 * 1024  # 50MB


def _storage_dir(exam_id: UUID) -> str:
    return os.path.join("storage", "exams", str(exam_id), "templates")


def _safe_stored_name() -> str:
    return f"template-{uuid.uuid4()}.pdf"


def validate_pdf_header(content: bytes) -> bool:
    return content[:5] == b"%PDF-"


def upload_template(
    db: Session,
    exam_id: UUID,
    filename: str,
    content: bytes,
    mime_type: str,
    user_id: UUID,
    crowdmark_exam_id: str | None = None,
    crowdmark_url: str | None = None,
) -> ExamTemplate:
    if len(content) > MAX_TEMPLATE_SIZE:
        raise ValueError(f"File too large (max {MAX_TEMPLATE_SIZE // (1024 * 1024)}MB)")

    if mime_type != PDF_MIME or not validate_pdf_header(content):
        raise ValueError("Only valid PDF files are supported")

    file_hash = hashlib.sha256(content).hexdigest()

    existing = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.file_hash == file_hash,
    ).first()
    if existing:
        raise ValueError("This template already exists (identical file)")

    # Archive current active template
    current_active = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()
    if current_active:
        current_active.is_active = False

    # Determine next version
    max_version = db.query(func.max(ExamTemplate.version)).filter(
        ExamTemplate.exam_id == exam_id
    ).scalar() or 0
    next_version = max_version + 1

    # Save file
    storage_dir = _storage_dir(exam_id)
    os.makedirs(storage_dir, exist_ok=True)
    stored_name = _safe_stored_name()
    filepath = os.path.join(storage_dir, stored_name)
    with open(filepath, "wb") as f:
        f.write(content)

    template = ExamTemplate(
        exam_id=exam_id,
        original_filename=filename,
        stored_filename=stored_name,
        mime_type=mime_type,
        file_size=len(content),
        file_hash=file_hash,
        version=next_version,
        is_active=True,
        crowdmark_exam_id=crowdmark_exam_id,
        crowdmark_url=crowdmark_url,
        created_by=user_id,
    )
    db.add(template)

    db.add(AuditLog(
        user_id=user_id,
        action="EXAM_TEMPLATE_UPLOADED",
        entity_type="exam_template",
        entity_id=None,
        new_values={
            "exam_id": str(exam_id),
            "version": next_version,
            "filename": filename,
            "file_size": len(content),
        },
    ))
    db.commit()
    db.refresh(template)
    return template


def list_templates(db: Session, exam_id: UUID) -> list[ExamTemplate]:
    return (
        db.query(ExamTemplate)
        .filter(ExamTemplate.exam_id == exam_id)
        .order_by(ExamTemplate.version.desc())
        .all()
    )


def get_active_template(db: Session, exam_id: UUID) -> ExamTemplate | None:
    return db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()


def get_template(db: Session, template_id: UUID) -> ExamTemplate | None:
    return db.query(ExamTemplate).filter(ExamTemplate.id == template_id).first()


def activate_template(db: Session, template_id: UUID, user_id: UUID) -> ExamTemplate:
    template = db.query(ExamTemplate).filter(ExamTemplate.id == template_id).first()
    if not template:
        raise ValueError("Template not found")

    # Deactivate current active
    current_active = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == template.exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
        ExamTemplate.id != template_id,
    ).first()
    if current_active:
        current_active.is_active = False

    template.is_active = True

    db.add(AuditLog(
        user_id=user_id,
        action="EXAM_TEMPLATE_ACTIVATED",
        entity_type="exam_template",
        entity_id=template_id,
        new_values={"exam_id": str(template.exam_id), "version": template.version},
    ))
    db.commit()
    db.refresh(template)
    return template


def archive_template(db: Session, template_id: UUID, user_id: UUID) -> ExamTemplate:
    template = db.query(ExamTemplate).filter(ExamTemplate.id == template_id).first()
    if not template:
        raise ValueError("Template not found")
    if template.is_active:
        raise ValueError("Cannot archive the active template. Activate another first.")

    template.is_active = False
    db.add(AuditLog(
        user_id=user_id,
        action="EXAM_TEMPLATE_ARCHIVED",
        entity_type="exam_template",
        entity_id=template_id,
        new_values={"exam_id": str(template.exam_id), "version": template.version},
    ))
    db.commit()
    db.refresh(template)
    return template


def get_template_path(template: ExamTemplate) -> str:
    return os.path.join(_storage_dir(template.exam_id), template.stored_filename)
