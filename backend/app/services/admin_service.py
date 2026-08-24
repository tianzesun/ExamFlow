import io
import os
import secrets
import zipfile
from datetime import datetime
from uuid import UUID

import fitz  # PyMuPDF
import qrcode
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.exam_assignment import ExamAssignment
from app.models.exam_room import ExamRoom
from app.models.exam_student import ExamStudent
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student

# ── QR Code Generation ──────────────────────────────────────

def generate_qr_token() -> str:
    return secrets.token_urlsafe(32)


def generate_qr_image(token: str, size: int = 200) -> bytes:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(token)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img = img.resize((size, size))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.read()


def generate_qr_for_exams(db: Session, exam_id: UUID, user_id: UUID) -> int:
    generated = db.query(GeneratedExam).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.qr_token.is_(None),
    ).all()

    count = 0
    for ge in generated:
        ge.qr_token = generate_qr_token()
        ge.qr_generated_at = datetime.utcnow()
        count += 1

    if count:
        db.add(AuditLog(
            user_id=user_id,
            action="QR_GENERATED",
            entity_type="exam",
            entity_id=exam_id,
            new_values={"count": count},
        ))
        db.commit()

    return count


def get_qr_token_for_exam(db: Session, generated_exam_id: UUID) -> str | None:
    ge = db.query(GeneratedExam).filter(GeneratedExam.id == generated_exam_id).first()
    return ge.qr_token if ge else None


# ── Signature List PDF ──────────────────────────────────────

def generate_signature_list_pdf(
    db: Session,
    exam_id: UUID,
    room_id: UUID,
) -> bytes:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    room = db.query(Room).filter(Room.id == room_id).first()
    if not exam or not room:
        raise ValueError("Exam or room not found")

    assignments = (
        db.query(ExamAssignment, Student, Seat)
        .join(ExamStudent, ExamAssignment.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .filter(ExamAssignment.exam_id == exam_id, Seat.room_id == room_id)
        .order_by(Seat.row_number, Seat.column_number)
        .all()
    )

    doc = fitz.open()
    page_width, page_height = 612, 792  # Letter
    margin = 50
    row_height = 28
    header_height = 120
    students_per_page = int((page_height - margin * 2 - header_height) / row_height)

    page_num = 0
    total_pages = max(1, -(-len(assignments) // students_per_page))  # ceil div

    for i in range(0, max(1, len(assignments)), students_per_page):
        page = doc.new_page(width=page_width, height=page_height)
        y = margin

        # Header
        page.insert_text(fitz.Point(margin, y), f"{exam.course_code} — {exam.exam_name}", fontsize=14, color=(0, 0, 0))
        y += 20
        page.insert_text(
            fitz.Point(margin, y),
            f"Room: {room.building} {room.room_number}",
            fontsize=11, color=(0, 0, 0),
        )
        y += 16
        page.insert_text(
            fitz.Point(margin, y),
            f"Date: {exam.exam_date}    Time: {exam.start_time}",
            fontsize=11, color=(0, 0, 0),
        )
        y += 16
        page_num += 1
        page.insert_text(
            fitz.Point(margin, y),
            f"Signature List — Page {page_num} of {total_pages}",
            fontsize=10, color=(0.5, 0.5, 0.5),
        )
        y += 20

        # Table header
        rect = fitz.Point(margin, y), fitz.Point(page_width - margin, y + row_height)
        page.draw_rect(rect, color=(0, 0, 0), fill=(0.9, 0.9, 0.9))
        cols = [margin + 5, margin + 60, margin + 200, margin + 310, margin + 430]
        headers = ["Seat", "Student ID", "Name", "Signature", "Time"]
        for col, header in zip(cols, headers):
            page.insert_text(fitz.Point(col, y + 18), header, fontsize=9, color=(0, 0, 0))
        y += row_height

        # Rows
        chunk = assignments[i:i + students_per_page]
        for assignment, student, seat in chunk:
            rect = fitz.Point(margin, y), fitz.Point(page_width - margin, y + row_height)
            page.draw_rect(rect, color=(0.8, 0.8, 0.8))
            page.insert_text(fitz.Point(cols[0], y + 18), seat.seat_code, fontsize=9, color=(0, 0, 0))
            page.insert_text(fitz.Point(cols[1], y + 18), student.student_number, fontsize=9, color=(0, 0, 0))
            name = student.full_name[:30]
            page.insert_text(fitz.Point(cols[2], y + 18), name, fontsize=9, color=(0, 0, 0))
            y += row_height

        # Empty rows to fill page
        for _ in range(students_per_page - len(chunk)):
            rect = fitz.Point(margin, y), fitz.Point(page_width - margin, y + row_height)
            page.draw_rect(rect, color=(0.8, 0.8, 0.8))
            y += row_height

    output = io.BytesIO()
    doc.save(output)
    doc.close()
    output.seek(0)
    return output.read()


# ── Seating Map PDF ─────────────────────────────────────────

def generate_seating_map_pdf(
    db: Session,
    exam_id: UUID,
    room_id: UUID,
) -> bytes:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    room = db.query(Room).filter(Room.id == room_id).first()
    if not exam or not room:
        raise ValueError("Exam or room not found")

    seats = db.query(Seat).filter(Seat.room_id == room_id).order_by(Seat.row_number, Seat.column_number).all()

    assignments = {}
    for a, s in (
        db.query(ExamAssignment, Student)
        .join(ExamStudent, ExamAssignment.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .filter(ExamAssignment.exam_id == exam_id, Seat.room_id == room_id)
        .all()
    ):
        assignments[str(a.seat_id)] = s

    doc = fitz.open()
    page_width, page_height = 612, 792  # Letter
    margin = 50

    page = doc.new_page(width=page_width, height=page_height)
    y = margin

    # Header
    page.insert_text(
        fitz.Point(margin, y),
        f"{exam.course_code} — {exam.exam_name}",
        fontsize=14, color=(0, 0, 0),
    )
    y += 20
    page.insert_text(
        fitz.Point(margin, y),
        f"Seating Map — {room.building} {room.room_number}",
        fontsize=11, color=(0, 0, 0),
    )
    y += 16
    page.insert_text(fitz.Point(margin, y), f"Date: {exam.exam_date}", fontsize=11, color=(0, 0, 0))
    y += 25

    # FRONT indicator
    rect = fitz.Point(margin, y), fitz.Point(page_width - margin, y + 25)
    page.draw_rect(rect, color=(0, 0, 0), fill=(0.85, 0.85, 0.85))
    page.insert_text(fitz.Point(page_width / 2 - 15, y + 17), "FRONT", fontsize=10, color=(0, 0, 0))
    y += 40

    # Calculate grid
    max_col = max((s.column_number or 1) for s in seats) if seats else 1

    seat_width = min(80, (page_width - margin * 2 - 20) / max_col)
    seat_height = 55
    start_x = margin + (page_width - margin * 2 - seat_width * max_col) / 2

    for seat in seats:
        row = (seat.row_number or 1) - 1
        col = (seat.column_number or 1) - 1
        x = start_x + col * seat_width
        sy = y + row * seat_height

        student = assignments.get(str(seat.id))

        if seat.status != "AVAILABLE":
            color = (0.9, 0.9, 0.9)
        elif student:
            color = (0.85, 0.95, 0.85)
        else:
            color = (1, 1, 1)

        rect = fitz.Point(x, sy), fitz.Point(x + seat_width - 4, sy + seat_height - 4)
        page.draw_rect(rect, color=(0, 0, 0), fill=color)
        page.insert_text(fitz.Point(x + 3, sy + 15), seat.seat_code, fontsize=8, color=(0, 0, 0))

        if student:
            name_short = student.full_name[:15]
            page.insert_text(fitz.Point(x + 3, sy + 28), name_short, fontsize=7, color=(0, 0, 0))
            page.insert_text(fitz.Point(x + 3, sy + 38), student.student_number[:10], fontsize=6, color=(0.4, 0.4, 0.4))
        elif seat.status != "AVAILABLE":
            page.insert_text(fitz.Point(x + 3, sy + 28), "N/A", fontsize=7, color=(0.6, 0.6, 0.6))
        else:
            page.insert_text(fitz.Point(x + 3, sy + 28), "EMPTY", fontsize=7, color=(0.6, 0.6, 0.6))

    output = io.BytesIO()
    doc.save(output)
    doc.close()
    output.seek(0)
    return output.read()


# ── Exam Summary PDF ────────────────────────────────────────

def generate_exam_summary_pdf(db: Session, exam_id: UUID) -> bytes:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")

    template = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()

    student_count = db.query(func.count(ExamStudent.id)).filter(ExamStudent.exam_id == exam_id).scalar() or 0
    assignment_count = db.query(func.count(ExamAssignment.id)).filter(ExamAssignment.exam_id == exam_id).scalar() or 0
    room_count = db.query(func.count(ExamRoom.id)).filter(ExamRoom.exam_id == exam_id).scalar() or 0
    doc_count = db.query(func.count(GeneratedExam.id)).filter(GeneratedExam.exam_id == exam_id).scalar() or 0

    page_width, page_height = 612, 792
    margin = 50

    doc = fitz.open()
    page = doc.new_page(width=page_width, height=page_height)
    y = margin

    page.insert_text(fitz.Point(margin, y), "EXAM ADMINISTRATION SUMMARY", fontsize=16, color=(0, 0, 0))
    y += 30

    lines = [
        ("Course", f"{exam.course_code} — {exam.course_name}"),
        ("Exam", exam.exam_name),
        ("Date", str(exam.exam_date)),
        ("Time", str(exam.start_time)),
        ("Duration", f"{exam.duration_minutes} minutes"),
        ("Term", f"{exam.term} {exam.academic_year}"),
        ("", ""),
        ("Students Registered", str(student_count)),
        ("Students Assigned", str(assignment_count)),
        ("Rooms", str(room_count)),
        ("", ""),
        ("Template", f"v{template.version}" if template else "None"),
        ("Personalized Exams", str(doc_count)),
        ("", ""),
        ("Generated", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")),
    ]

    for label, value in lines:
        if label:
            page.insert_text(fitz.Point(margin, y), f"{label}:", fontsize=11, color=(0, 0, 0))
            page.insert_text(fitz.Point(margin + 180, y), value, fontsize=11, color=(0, 0, 0))
        y += 18

    output = io.BytesIO()
    doc.save(output)
    doc.close()
    output.seek(0)
    return output.read()


# ── ZIP Package ─────────────────────────────────────────────

def generate_exam_package(
    db: Session,
    exam_id: UUID,
    user_id: UUID,
) -> tuple[bytes, str]:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")

    # Generate QR tokens for any without
    generate_qr_for_exams(db, exam_id, user_id)

    # Get rooms
    rooms = (
        db.query(Room)
        .join(ExamRoom, ExamRoom.room_id == Room.id)
        .filter(ExamRoom.exam_id == exam_id)
        .order_by(Room.building, Room.room_number)
        .all()
    )

    # Get generated exams
    generated = db.query(GeneratedExam).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.status == "GENERATED",
    ).all()

    if not generated:
        raise ValueError("No personalized exams generated. Generate exams first.")

    safe_name = f"{exam.course_code}-{exam.exam_name}".replace(" ", "-").replace("/", "-")[:50]
    zip_filename = f"{safe_name}-Administration-Package.zip"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Exam summary
        summary_pdf = generate_exam_summary_pdf(db, exam_id)
        zf.writestr(f"{safe_name}/Exam-Summary.pdf", summary_pdf)

        # Signature lists and seating maps per room
        for room in rooms:
            room_dir = f"{safe_name}/Rooms/{room.building}{room.room_number}"
            try:
                sig_pdf = generate_signature_list_pdf(db, exam_id, room.id)
                zf.writestr(f"{room_dir}/Signature-List.pdf", sig_pdf)
            except Exception:
                pass
            try:
                map_pdf = generate_seating_map_pdf(db, exam_id, room.id)
                zf.writestr(f"{room_dir}/Seating-Map.pdf", map_pdf)
            except Exception:
                pass

        # Personalized exams
        for ge in generated:
            if os.path.exists(ge.storage_key):
                zf.write(ge.storage_key, f"{safe_name}/Personalized-Exams/{ge.file_name}")

        # Manifest
        manifest = (
            f"Exam: {exam.course_code} — {exam.exam_name}\n"
            f"Date: {exam.exam_date}\n"
            f"Students: {len(generated)}\n"
            f"Rooms: {len(rooms)}\n"
            f"Generated: {datetime.utcnow().isoformat()}\n"
        )
        zf.writestr(f"{safe_name}/README.txt", manifest)

    buf.seek(0)
    zip_bytes = buf.read()

    # Audit
    db.add(AuditLog(
        user_id=user_id,
        action="EXAM_PACKAGE_GENERATED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={"room_count": len(rooms), "document_count": len(generated)},
    ))
    db.commit()

    return zip_bytes, zip_filename
