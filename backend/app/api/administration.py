from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.generated_exam import GeneratedExam
from app.models.user import User
from app.rate_limit import per_address, per_user
from app.services import admin_service
from app.services.access_service import require_exam_access
from app.services.exam_status_service import block_writes_to_archived_exam
from app.utils import attachment_headers

router = APIRouter(tags=["administration"], dependencies=[Depends(require_exam_access)])


# ── QR Generate ─────────────────────────────────────────────

@router.post("/api/exams/{exam_id}/qr/generate", dependencies=[Depends(block_writes_to_archived_exam)])
def generate_qr(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    count = admin_service.generate_qr_for_exams(db, exam_id, user.id)
    return {"generated": count}


# ── QR Verify ───────────────────────────────────────────────

@router.get("/api/verify/{token}", dependencies=[Depends(per_address("qr-check", 60, 60))])
def verify_qr(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    ge = db.query(GeneratedExam).filter(GeneratedExam.qr_token == token).first()
    if not ge:
        db.add(AuditLog(
            action="QR_VERIFY_FAILED",
            entity_type="generated_exam",
            new_values={"ip": request.client.host if request.client else "unknown"},
        ))
        db.commit()
        return {"valid": False, "message": "Invalid token"}

    db.add(AuditLog(
        action="QR_VERIFIED",
        entity_type="generated_exam",
        entity_id=ge.id,
        new_values={"ip": request.client.host if request.client else "unknown"},
    ))
    db.commit()

    if ge.status != "GENERATED":
        # The paper was replaced by a later generation; this copy shouldn't be in use.
        return {"valid": False, "message": "This paper has been replaced by a newer version", "status": ge.status}

    exam = db.query(Exam).filter(Exam.id == ge.exam_id).first()
    return {
        "valid": True,
        "message": "Valid Exam Document",
        "status": ge.status,
        # Identifies the sitting only; nothing about the student is disclosed.
        "course_code": exam.course_code if exam else None,
        "exam_name": exam.exam_name if exam else None,
        "exam_date": exam.exam_date.isoformat() if exam else None,
        "generation_version": ge.generation_version,
    }


# ── Signature List ──────────────────────────────────────────

@router.get("/api/exams/{exam_id}/signature-list/{room_id}")
def download_signature_list(
    exam_id: UUID,
    room_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    try:
        pdf_bytes = admin_service.generate_signature_list_pdf(db, exam_id, room_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return Response(content=pdf_bytes, media_type="application/pdf", headers=attachment_headers("Signature-List.pdf"))


# ── Seating List (whole exam) ────────────────────────────────

@router.get("/api/exams/{exam_id}/seating-list")
def download_seating_list(
    exam_id: UUID,
    format: str = Query("pdf", pattern="^(pdf|csv)$"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    name = f"{exam.course_code}-Seating-List"
    if format == "csv":
        # BOM so Excel opens accented names correctly.
        data = "\ufeff" + admin_service.generate_seating_list_csv(db, exam_id)
        return Response(content=data, media_type="text/csv; charset=utf-8", headers=attachment_headers(f"{name}.csv"))
    try:
        pdf_bytes = admin_service.generate_seating_list_pdf(db, exam_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return Response(content=pdf_bytes, media_type="application/pdf", headers=attachment_headers(f"{name}.pdf"))


# ── Seating Map ─────────────────────────────────────────────

@router.get("/api/exams/{exam_id}/seating-map/{room_id}")
def download_seating_map(
    exam_id: UUID,
    room_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    try:
        pdf_bytes = admin_service.generate_seating_map_pdf(db, exam_id, room_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return Response(content=pdf_bytes, media_type="application/pdf", headers=attachment_headers("Seating-Map.pdf"))


# ── Package Generate ────────────────────────────────────────

@router.post(
    "/api/exams/{exam_id}/package/generate",
    dependencies=[Depends(block_writes_to_archived_exam), Depends(per_user("exam-files", 30, 600))],
)
def generate_package(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        zip_bytes, filename = admin_service.generate_exam_package(db, exam_id, user.id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"filename": filename, "size": len(zip_bytes)}


# ── Package Download ────────────────────────────────────────

@router.get("/api/exams/{exam_id}/package/download", dependencies=[Depends(per_user("exam-files", 30, 600))])
def download_package(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        zip_bytes, filename = admin_service.generate_exam_package(db, exam_id, user.id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return Response(content=zip_bytes, media_type="application/zip", headers=attachment_headers(filename))
