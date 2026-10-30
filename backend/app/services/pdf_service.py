import hashlib
import html
import io
import os
import secrets
import uuid
from collections.abc import Callable
from uuid import UUID

import pymupdf
import qrcode
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.exam_assignment import ExamAssignment
from app.models.exam_student import ExamStudent
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student
from app.utils import utcnow

MARGIN = 36
# Band reserved at the top of each page for the student's details.
FIRST_BAND = 78
OTHER_BAND = 22
QR_SIZE = 58
# Clearance kept between the stamp and the paper's own content.
CONTENT_GAP = 4

_CSS = "* {font-family: sans-serif; margin: 0; padding: 0; color: #000;} b {font-weight: bold;}"


def write_text(page: pymupdf.Page, rect: pymupdf.Rect, text: str, size: float = 10,
               bold: bool = False, align: str = "left", grey: bool = False) -> None:
    """Write one line of text, falling back to other fonts for accents and non-Latin names.

    The base-14 fonts used by insert_text can't show names like Nguyễn or 李华.
    """
    content = html.escape(text)
    if bold:
        content = f"<b>{content}</b>"
    colour = "#555" if grey else "#000"
    page.insert_htmlbox(
        rect, f'<p style="font-size:{size}pt; text-align:{align}; color:{colour}">{content}</p>',
        css=_CSS, scale_low=0.5,
    )


def verify_url(token: str) -> str:
    return f"{get_settings().PUBLIC_APP_URL.rstrip('/')}/verify/{token}"


def _qr_png(token: str) -> bytes:
    img = qrcode.make(verify_url(token), box_size=4, border=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _content_top(page: pymupdf.Page) -> float:
    """Top edge of the highest thing printed on the page, ignoring full-page backgrounds."""
    area = abs(page.rect)
    tops = [
        (pymupdf.Rect(r) * page.rotation_matrix).y0
        for _, r in page.get_bboxlog()
        if not pymupdf.Rect(r).is_empty and abs(pymupdf.Rect(r)) < 0.9 * area
    ]
    return min(tops, default=page.rect.height)


def _place_pages(template: pymupdf.Document) -> pymupdf.Document:
    """Copy the paper, keeping room for the stamp at the top of every page.

    A page with an empty top margin is copied as is; otherwise its content is
    scaled down just enough to clear the band, so nothing is ever printed over.
    """
    out = pymupdf.open()
    for i, page in enumerate(template):
        band = FIRST_BAND if i == 0 else OTHER_BAND
        if _content_top(page) >= band + CONTENT_GAP:
            out.insert_pdf(template, from_page=i, to_page=i)
        else:
            w, h = page.rect.width, page.rect.height
            target = out.new_page(width=w, height=h)
            target.show_pdf_page(pymupdf.Rect(0, band + CONTENT_GAP, w, h), template, i)
    return out


def _stamp_first_page(page: pymupdf.Page, exam: Exam, student: Student, room: Room, seat: Seat,
                      qr_token: str | None) -> None:
    w = page.rect.width
    right = w - MARGIN
    top = 14
    if qr_token:
        page.insert_image(pymupdf.Rect(right - QR_SIZE, top, right, top + QR_SIZE), stream=_qr_png(qr_token))
        right -= QR_SIZE + 10

    # Room and seat sit in a box so proctors can check them at a glance.
    box = pymupdf.Rect(right - 150, top + 2, right, top + 56)
    page.draw_rect(box, color=(0, 0, 0), width=1)
    page.draw_line(pymupdf.Point(box.x0, box.y0 + 27), pymupdf.Point(box.x1, box.y0 + 27), color=(0, 0, 0), width=0.5)
    write_text(page, pymupdf.Rect(box.x0 + 6, box.y0 + 10, box.x0 + 40, box.y0 + 24), "ROOM", 7, grey=True)
    write_text(page, pymupdf.Rect(box.x0 + 40, box.y0 + 3, box.x1 - 6, box.y0 + 25),
               f"{room.building} {room.room_number}", 12, bold=True, align="right")
    write_text(page, pymupdf.Rect(box.x0 + 6, box.y0 + 40, box.x0 + 40, box.y0 + 52), "SEAT", 7, grey=True)
    write_text(page, pymupdf.Rect(box.x0 + 40, box.y0 + 29, box.x1 - 6, box.y0 + 53),
               seat.seat_code, 15, bold=True, align="right")

    text_right = box.x0 - 12
    write_text(page, pymupdf.Rect(MARGIN, top, text_right, top + 16), f"{exam.course_code} — {exam.exam_name}", 9,
               grey=True)
    write_text(page, pymupdf.Rect(MARGIN, top + 14, text_right, top + 40), student.full_name, 15, bold=True)
    write_text(page, pymupdf.Rect(MARGIN, top + 40, text_right, top + 56), f"Student number: {student.student_number}",
               10)

    y = FIRST_BAND - 2
    page.draw_line(pymupdf.Point(MARGIN, y), pymupdf.Point(w - MARGIN, y), color=(0, 0, 0), width=0.75)


def _stamp_other_page(page: pymupdf.Page, student: Student, room: Room, seat: Seat, number: int, total: int) -> None:
    """A slim line so a page that comes loose can be matched to its student."""
    w = page.rect.width
    write_text(
        page, pymupdf.Rect(MARGIN, 6, w - MARGIN - 80, 18),
        f"{student.full_name} · {student.student_number} · {room.building} {room.room_number} · Seat {seat.seat_code}",
        8,
    )
    write_text(page, pymupdf.Rect(w - MARGIN - 80, 6, w - MARGIN, 18), f"Page {number} of {total}", 8,
               align="right", grey=True)
    page.draw_line(pymupdf.Point(MARGIN, OTHER_BAND - 2), pymupdf.Point(w - MARGIN, OTHER_BAND - 2),
                   color=(0.6, 0.6, 0.6), width=0.5)


def generate_one_student_pdf(
    template_bytes: bytes,
    exam: Exam,
    student: Student,
    room: Room,
    seat: Seat,
    qr_token: str | None = None,
) -> bytes:
    template = pymupdf.open(stream=template_bytes, filetype="pdf")
    try:
        if len(template) == 0:
            raise ValueError("Template PDF has no pages")
        doc = _place_pages(template)
    finally:
        template.close()

    try:
        _stamp_first_page(doc[0], exam, student, room, seat, qr_token)
        for i in range(1, len(doc)):
            _stamp_other_page(doc[i], student, room, seat, i + 1, len(doc))
        # Only embed the glyphs used; whole fallback fonts add megabytes per paper.
        doc.subset_fonts()
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def validate_generation(db: Session, exam_id: UUID) -> list[str]:
    errors = []

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        errors.append("Exam not found")
        return errors

    template = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()
    if not template:
        errors.append("No active template found")
        return errors

    template_path = os.path.join(
        "storage", "exams", str(exam_id), "templates", template.stored_filename
    )
    if not os.path.exists(template_path):
        errors.append("Template file not found on disk")
        return errors

    roster_count = db.query(func.count(ExamStudent.id)).filter(
        ExamStudent.exam_id == exam_id
    ).scalar() or 0

    assignment_count = db.query(func.count(ExamAssignment.id)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 0

    if roster_count == 0:
        errors.append("No students in roster")
    if assignment_count == 0:
        errors.append("No seating assignments found")
    if roster_count != assignment_count:
        errors.append(
            f"Roster ({roster_count}) and assignments ({assignment_count}) count mismatch"
        )

    return errors


def generate_all_exams(
    db: Session,
    exam_id: UUID,
    user_id: UUID,
    on_progress: Callable[[int, int], None] | None = None,
) -> dict:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")

    template = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()
    if not template:
        raise ValueError("No active template")

    template_path = os.path.join(
        "storage", "exams", str(exam_id), "templates", template.stored_filename
    )
    if not os.path.exists(template_path):
        raise ValueError("Template file not found")

    with open(template_path, "rb") as f:
        template_bytes = f.read()

    # Verify template hash
    template_hash = hashlib.sha256(template_bytes).hexdigest()
    if template_hash != template.file_hash:
        raise ValueError("Template file corrupted (hash mismatch)")

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
        raise ValueError("No assignments found")

    # Determine generation version
    max_version = db.query(func.max(GeneratedExam.generation_version)).filter(
        GeneratedExam.exam_id == exam_id
    ).scalar() or 0
    new_version = max_version + 1

    # Storage directory
    storage_dir = os.path.join("storage", "exams", str(exam_id), "generated")
    os.makedirs(storage_dir, exist_ok=True)

    generated_count = 0
    failed_count = 0
    failed_student = None
    generated_objects: list[GeneratedExam] = []

    for done, (assignment, student, seat, room) in enumerate(assignments, start=1):
        try:
            qr_token = secrets.token_urlsafe(32)
            pdf_bytes = generate_one_student_pdf(template_bytes, exam, student, room, seat, qr_token)
            file_hash = hashlib.sha256(pdf_bytes).hexdigest()

            file_name = f"{exam.course_code}-{student.student_number}-v{new_version}.pdf"
            stored_name = f"{uuid.uuid4()}.pdf"
            filepath = os.path.join(storage_dir, stored_name)

            with open(filepath, "wb") as f:
                f.write(pdf_bytes)

            ge = GeneratedExam(
                exam_id=exam_id,
                exam_student_id=assignment.exam_student_id,
                exam_assignment_id=assignment.id,
                exam_template_id=template.id,
                file_name=file_name,
                storage_key=filepath,
                file_size=len(pdf_bytes),
                file_hash=file_hash,
                status="GENERATED",
                generation_version=new_version,
                qr_token=qr_token,
                qr_generated_at=utcnow(),
                created_by=user_id,
            )
            generated_objects.append(ge)
            generated_count += 1
        except Exception:
            failed_count += 1
            if not failed_student:
                failed_student = student.student_number
        if on_progress:
            on_progress(done, len(assignments))

    # Check for failures
    if failed_count > 0:
        # Rollback: delete any files we just created
        for ge in generated_objects:
            if os.path.exists(ge.storage_key):
                os.remove(ge.storage_key)
        raise ValueError(
            f"Generation failed for {failed_count} student(s). "
            f"First failure near student: {failed_student}"
        )

    # All succeeded — retire earlier versions so counts, packages and QR checks only see this set.
    db.query(GeneratedExam).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.status == "GENERATED",
    ).update({"status": "SUPERSEDED"}, synchronize_session=False)
    db.add_all(generated_objects)
    db.add(AuditLog(
        user_id=user_id,
        action="PERSONALIZED_EXAMS_GENERATION_COMPLETED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={
            "template_version": template.version,
            "assignment_version": assignments[0][0].version if assignments else 0,
            "generation_version": new_version,
            "count": len(generated_objects),
        },
    ))
    db.commit()

    return {
        "generated": generated_count,
        "failed": failed_count,
        "generation_version": new_version,
    }


def get_generated_exams(
    db: Session,
    exam_id: UUID,
    query: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict], int]:
    q = (
        db.query(GeneratedExam, Student, ExamTemplate)
        .join(ExamStudent, GeneratedExam.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .outerjoin(ExamTemplate, GeneratedExam.exam_template_id == ExamTemplate.id)
        .filter(GeneratedExam.exam_id == exam_id, GeneratedExam.status == "GENERATED")
    )

    if query:
        pattern = f"%{query}%"
        q = q.filter(
            (Student.student_number.ilike(pattern)) |
            (Student.full_name.ilike(pattern))
        )

    total = q.count()
    results = (
        q.order_by(Student.student_number)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return [
        {
            "id": str(ge.id),
            "student_id": str(s.id),
            "student_number": s.student_number,
            "full_name": s.full_name,
            "file_name": ge.file_name,
            "file_size": ge.file_size,
            "file_hash": ge.file_hash,
            "status": ge.status,
            "generation_version": ge.generation_version,
            "has_qr": ge.qr_token is not None,
            "template_version": tmpl.version if tmpl else None,
            "created_at": ge.created_at.isoformat() if ge.created_at else None,
        }
        for ge, s, tmpl in results
    ], total


def get_generated_exam(db: Session, generated_exam_id: UUID) -> GeneratedExam | None:
    return db.query(GeneratedExam).filter(GeneratedExam.id == generated_exam_id).first()


def build_print_file(
    db: Session,
    exam_id: UUID,
    user_id: UUID,
    room_id: UUID | None = None,
    double_sided: bool = False,
) -> tuple[bytes, str]:
    """All current papers in one PDF, room by room in seat order, ready to send to a printer.

    Each room opens with a divider sheet so the stack can be split for proctors. When
    printing double-sided, a blank page is added after any paper with an odd page count
    so the next student's paper starts on a fresh sheet.
    """
    from app.services.admin_service import seat_order

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")

    q = (
        db.query(GeneratedExam, Student, Seat, Room)
        .join(ExamAssignment, GeneratedExam.exam_assignment_id == ExamAssignment.id)
        .join(ExamStudent, GeneratedExam.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .join(Room, Seat.room_id == Room.id)
        .filter(GeneratedExam.exam_id == exam_id, GeneratedExam.status == "GENERATED")
    )
    if room_id:
        q = q.filter(Seat.room_id == room_id)
    papers = sorted(q.all(), key=lambda r: (r[3].building, r[3].room_number, seat_order(r[2])))
    if not papers:
        raise ValueError("No papers have been generated for this selection. Generate papers first.")

    out = pymupdf.open()

    def pad_to_sheet() -> None:
        if double_sided and len(out) % 2:
            out.new_page(width=out[-1].rect.width, height=out[-1].rect.height)

    current_room = None
    for ge, _student, seat, room in papers:
        if room.id != current_room:
            current_room = room.id
            in_room = [p for p in papers if p[3].id == room.id]
            pad_to_sheet()
            divider = out.new_page(width=612, height=792)
            write_text(divider, pymupdf.Rect(72, 260, 540, 300), f"{exam.course_code} — {exam.exam_name}", 16,
                       bold=True, align="center")
            write_text(divider, pymupdf.Rect(72, 310, 540, 370), f"{room.building} {room.room_number}", 36,
                       bold=True, align="center")
            write_text(divider, pymupdf.Rect(72, 380, 540, 400),
                       f"{len(in_room)} papers · seats {in_room[0][2].seat_code} to {in_room[-1][2].seat_code}"
                       " · in seat order", 12, align="center", grey=True)
            pad_to_sheet()
        if not os.path.exists(ge.storage_key):
            raise ValueError(f"The paper for seat {seat.seat_code} is missing. Generate papers again.")
        with pymupdf.open(ge.storage_key) as paper:
            out.insert_pdf(paper)
        pad_to_sheet()

    data = out.tobytes(garbage=1, deflate=True)
    out.close()

    db.add(AuditLog(
        user_id=user_id,
        action="PRINT_FILE_DOWNLOADED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={"room_id": str(room_id) if room_id else None, "papers": len(papers),
                    "double_sided": double_sided},
    ))
    db.commit()

    scope = f"{papers[0][3].building}{papers[0][3].room_number}" if room_id else "all-rooms"
    return data, f"{exam.course_code}-{exam.exam_name}-papers-{scope}.pdf"
