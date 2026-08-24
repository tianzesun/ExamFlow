import io
import os
from uuid import UUID

import fitz  # PyMuPDF
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.exam_assignment import ExamAssignment
from app.models.exam_student import ExamStudent
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student


def overlay_text_on_pdf(
    pdf_bytes: bytes,
    overlays: list[dict],
) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for overlay in overlays:
        page_idx = overlay.get("page", 0)
        if page_idx >= len(doc):
            page_idx = len(doc) - 1

        page = doc[page_idx]
        rect = page.rect

        text = overlay.get("text", "")
        font_size = overlay.get("font_size", 12)
        position = overlay.get("position", "top_right")
        color = overlay.get("color", (0, 0, 0))

        if position == "top_right":
            x = rect.width - 200
            y = 30
        elif position == "top_left":
            x = 30
            y = 30
        elif position == "bottom_right":
            x = rect.width - 200
            y = rect.height - 30
        elif position == "bottom_left":
            x = 30
            y = rect.height - 30
        else:
            x = rect.width - 200
            y = 30

        text_point = fitz.Point(x, y)
        page.insert_text(
            text_point,
            text,
            fontsize=font_size,
            color=color,
        )

    output = io.BytesIO()
    doc.save(output)
    doc.close()
    output.seek(0)
    return output.read()


def generate_personalized_pdf(
    db: Session,
    exam_id: UUID,
    original_pdf_path: str,
) -> bytes:
    with open(original_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    assignments = (
        db.query(ExamAssignment, Student, Seat, Room)
        .join(ExamStudent, ExamAssignment.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .join(Room, Seat.room_id == Room.id)
        .filter(ExamAssignment.exam_id == exam_id)
        .order_by(Student.student_number)
        .all()
    )

    if not assignments:
        return pdf_bytes

    overlays = []
    for assignment, student, seat, room in assignments:
        text = (
            f"Name: {student.full_name}\n"
            f"ID: {student.student_number}\n"
            f"Room: {room.building} {room.room_number}\n"
            f"Seat: {seat.seat_code}"
        )
        overlays.append({
            "text": text,
            "page": 0,
            "font_size": 10,
            "position": "top_right",
            "color": (0, 0, 0),
        })

    return overlay_text_on_pdf(pdf_bytes, overlays[:1])


def save_pdf_to_storage(
    db: Session,
    exam_id: UUID,
    pdf_bytes: bytes,
    filename: str,
    user_id: UUID,
    document_type: str = "PERSONALIZED_EXAM",
) -> Document:
    storage_path = os.path.join("storage", "exams", str(exam_id), "generated")
    os.makedirs(storage_path, exist_ok=True)

    filepath = os.path.join(storage_path, filename)
    with open(filepath, "wb") as f:
        f.write(pdf_bytes)

    import hashlib
    checksum = hashlib.sha256(pdf_bytes).hexdigest()

    existing_max_version = db.query(Document).filter(
        Document.exam_id == exam_id,
        Document.document_type == document_type,
    ).count()

    doc = Document(
        exam_id=exam_id,
        document_type=document_type,
        version=existing_max_version + 1,
        filename=filename,
        storage_key=filepath,
        file_size=len(pdf_bytes),
        checksum=checksum,
        created_by=user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
