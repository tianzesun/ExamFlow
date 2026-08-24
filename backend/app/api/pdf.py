import os
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.document import Document
from app.models.user import User
from app.services import pdf_service

router = APIRouter(prefix="/api/exams/{exam_id}/pdf", tags=["pdf"])


class PdfUploadResponse(BaseModel):
    id: str
    filename: str
    file_size: int


@router.post("/upload", response_model=PdfUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    exam_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 50MB)")

    storage_path = os.path.join("storage", "exams", str(exam_id), "original")
    os.makedirs(storage_path, exist_ok=True)

    filepath = os.path.join(storage_path, file.filename)
    with open(filepath, "wb") as f:
        f.write(content)

    import hashlib
    checksum = hashlib.sha256(content).hexdigest()

    doc = Document(
        exam_id=exam_id,
        document_type="ORIGINAL_TEMPLATE",
        version=1,
        filename=file.filename,
        storage_key=filepath,
        file_size=len(content),
        checksum=checksum,
        created_by=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return PdfUploadResponse(id=str(doc.id), filename=file.filename, file_size=len(content))


@router.post("/generate")
def generate_pdf(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    original = db.query(Document).filter(
        Document.exam_id == exam_id,
        Document.document_type == "ORIGINAL_TEMPLATE",
    ).order_by(Document.version.desc()).first()

    if not original:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No original PDF uploaded")

    if not os.path.exists(original.storage_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Original PDF file not found")

    personalized_bytes = pdf_service.generate_personalized_pdf(db, exam_id, original.storage_key)

    output_filename = f"personalized_{original.filename}"
    doc = pdf_service.save_pdf_to_storage(
        db, exam_id, personalized_bytes, output_filename, user.id, "PERSONALIZED_EXAM"
    )

    return {
        "id": str(doc.id),
        "filename": output_filename,
        "file_size": doc.file_size,
        "version": doc.version,
    }


@router.get("/download")
def download_pdf(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.exam_id == exam_id,
        Document.document_type == "PERSONALIZED_EXAM",
    ).order_by(Document.version.desc()).first()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No generated PDF found")

    if not os.path.exists(doc.storage_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file not found")

    def iterfile():
        with open(doc.storage_key, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
    )


@router.get("/documents", response_model=list[dict])
def list_documents(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    docs = db.query(Document).filter(Document.exam_id == exam_id).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": str(d.id),
            "document_type": d.document_type,
            "version": d.version,
            "filename": d.filename,
            "file_size": d.file_size,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]
