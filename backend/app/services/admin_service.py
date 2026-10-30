import csv
import html
import io
import os
import secrets
import zipfile
from uuid import UUID

import pymupdf
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
from app.services import paper_state
from app.utils import utcnow

# ── QR Code Generation ──────────────────────────────────────

def generate_qr_token() -> str:
    return secrets.token_urlsafe(32)


def generate_qr_for_exams(db: Session, exam_id: UUID, user_id: UUID) -> int:
    generated = db.query(GeneratedExam).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.qr_token.is_(None),
        GeneratedExam.status == "GENERATED",
    ).all()

    count = 0
    for ge in generated:
        ge.qr_token = generate_qr_token()
        ge.qr_generated_at = utcnow()
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


# ── Printable tables ────────────────────────────────────────

LETTER = (612, 792)
PAGE_MARGIN = 40

_TABLE_CSS = """
* {font-family: sans-serif; font-size: 9pt; color: #000;}
h1 {font-size: 14pt; margin: 0 0 2pt 0;}
p.sub {font-size: 9.5pt; color: #333; margin: 0 0 8pt 0;}
table {border-collapse: collapse; width: 100%;}
th {background-color: #e8e8e8; font-weight: bold; text-align: left; border: 0.6pt solid #666; padding: 4pt 5pt;}
td {border: 0.5pt solid #999; padding: 4pt 5pt;}
table.tall td {padding: 8pt 5pt;}
"""


def _room_label(room: Room) -> str:
    return f"{room.building} {room.room_number}"


def _exam_when(exam: Exam) -> str:
    when = exam.exam_date.strftime("%A, %B %-d, %Y") if exam.exam_date else ""
    if exam.start_time:
        when += f" at {exam.start_time.strftime('%-I:%M %p')}"
    return when


def table_pdf(
    title: str,
    subtitle: str,
    columns: list[tuple[str, int]],
    rows: list[list[str]],
    rows_per_page: int = 32,
    tall_rows: bool = False,
    pad_last_page: bool = False,
) -> bytes:
    """Lay rows out as a paginated table, repeating the heading on every page.

    columns are (heading, width in percent). Text goes through HTML so names in
    any script print correctly.
    """
    pages = [rows[i:i + rows_per_page] for i in range(0, len(rows), rows_per_page)] or [[]]
    if pad_last_page:
        pages[-1] = pages[-1] + [[""] * len(columns)] * (rows_per_page - len(pages[-1]))

    width, height = LETTER
    # MuPDF ignores percentage column widths, so convert them to points.
    usable = width - PAGE_MARGIN * 2 - 14 * len(columns)
    head = "".join(f'<th style="width:{usable * w / 100:.0f}pt">{html.escape(h)}</th>' for h, w in columns)
    doc = pymupdf.open()
    for number, chunk in enumerate(pages, start=1):
        page = doc.new_page(width=width, height=height)
        body = "".join(
            "<tr>" + "".join(f"<td>{html.escape(cell) or '&nbsp;'}</td>" for cell in row) + "</tr>"
            for row in chunk
        )
        page.insert_htmlbox(
            pymupdf.Rect(PAGE_MARGIN, PAGE_MARGIN, width - PAGE_MARGIN, height - PAGE_MARGIN - 20),
            f'<h1>{html.escape(title)}</h1><p class="sub">{html.escape(subtitle)}</p>'
            f'<table class="{"tall" if tall_rows else ""}"><tr>{head}</tr>{body}</table>',
            css=_TABLE_CSS, scale_low=0.6,
        )
        page.insert_text(
            pymupdf.Point(PAGE_MARGIN, height - PAGE_MARGIN + 4),
            f"Page {number} of {len(pages)}", fontsize=8, color=(0.4, 0.4, 0.4),
        )
    doc.subset_fonts()
    data = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return data


def _seated_students(
    db: Session, exam_id: UUID, room_id: UUID | None = None
) -> list[tuple[Student, Seat, Room, str]]:
    """(student, seat, room, paper version) for every seated student."""
    q = (
        db.query(Student, Seat, Room, ExamAssignment.paper_version)
        .join(ExamStudent, ExamStudent.student_id == Student.id)
        .join(ExamAssignment, ExamAssignment.exam_student_id == ExamStudent.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .join(Room, Seat.room_id == Room.id)
        .filter(ExamAssignment.exam_id == exam_id)
    )
    if room_id:
        q = q.filter(Seat.room_id == room_id)
    return q.all()


def _has_versions(db: Session, exam_id: UUID) -> bool:
    return db.query(ExamAssignment.paper_version).filter(
        ExamAssignment.exam_id == exam_id, ExamAssignment.paper_version != "A"
    ).first() is not None


def seat_order(seat: Seat) -> tuple:
    return (seat.row_number or 0, seat.column_number or 0, seat.seat_code)


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

    seated = sorted(_seated_students(db, exam_id, room_id), key=lambda r: seat_order(r[1]))
    if _has_versions(db, exam_id):
        columns = [("Seat", 8), ("Version", 9), ("Student number", 16), ("Name", 32), ("Signature", 25), ("Time", 10)]
        rows = [[seat.seat_code, version, student.student_number, student.full_name, "", ""]
                for student, seat, _, version in seated]
    else:
        columns = [("Seat", 9), ("Student number", 17), ("Name", 36), ("Signature", 28), ("Time", 10)]
        rows = [[seat.seat_code, student.student_number, student.full_name, "", ""] for student, seat, _, _ in seated]
    return table_pdf(
        f"{exam.course_code} — {exam.exam_name}",
        f"Signature list · {_room_label(room)} · {_exam_when(exam)}",
        columns, rows, rows_per_page=24, tall_rows=True, pad_last_page=True,
    )


# ── Seating List (whole exam, by name) ──────────────────────

def seating_list_rows(db: Session, exam_id: UUID) -> list[tuple[Student, Seat, Room, str]]:
    """Every seated student, by name, so a student can find their room and seat."""
    return sorted(_seated_students(db, exam_id), key=lambda r: (r[0].full_name.casefold(), r[0].student_number))


def generate_seating_list_pdf(db: Session, exam_id: UUID) -> bytes:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")
    rows = seating_list_rows(db, exam_id)
    if not rows:
        raise ValueError("No students have seats yet")
    columns = [("Name", 44), ("Student number", 22), ("Room", 20), ("Seat", 14)]
    table = [[student.full_name, student.student_number, _room_label(room), seat.seat_code]
             for student, seat, room, _ in rows]
    if _has_versions(db, exam_id):
        columns = [("Name", 40), ("Student number", 20), ("Room", 18), ("Seat", 11), ("Version", 11)]
        table = [row + [version] for row, (*_, version) in zip(table, rows)]
    return table_pdf(
        f"{exam.course_code} — {exam.exam_name}",
        f"Seating list · {_exam_when(exam)} · {len(rows)} students",
        columns, table,
    )


def _csv_cell(value: str) -> str:
    # Spreadsheets run cells starting with these as formulas.
    return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


def generate_seating_list_csv(db: Session, exam_id: UUID) -> str:
    rows = seating_list_rows(db, exam_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    versions = _has_versions(db, exam_id)
    writer.writerow(["Name", "Student number", "UTORid", "Room", "Seat"] + (["Version"] if versions else []))
    for student, seat, room, version in rows:
        values = [student.full_name, student.student_number, student.utorid or "", _room_label(room), seat.seat_code]
        writer.writerow([_csv_cell(v) for v in values + ([version] if versions else [])])
    return buf.getvalue()


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

    max_row = max((s.row_number or 1) for s in seats) if seats else 1
    max_col = max((s.column_number or 1) for s in seats) if seats else 1
    # Wide rooms print in landscape; the grid is scaled so every row fits one page.
    page_width, page_height = (LETTER[1], LETTER[0]) if max_col > max_row else LETTER
    margin = PAGE_MARGIN

    doc = pymupdf.open()
    page = doc.new_page(width=page_width, height=page_height)
    page.insert_htmlbox(
        pymupdf.Rect(margin, margin, page_width - margin, margin + 44),
        f"<h1>{html.escape(exam.course_code)} — {html.escape(exam.exam_name)}</h1>"
        f'<p class="sub">Seating map · {html.escape(_room_label(room))} · {html.escape(_exam_when(exam))}'
        f" · {len(assignments)} seated</p>",
        css=_TABLE_CSS,
    )
    y = margin + 50

    # FRONT indicator
    front = pymupdf.Rect(margin, y, page_width - margin, y + 18)
    page.draw_rect(front, color=(0, 0, 0), fill=(0.85, 0.85, 0.85))
    page.insert_htmlbox(front, "<b>FRONT</b>", css="* {font-family: sans-serif; font-size: 9pt; text-align: center;}")
    y += 26

    avail_w = page_width - margin * 2
    avail_h = page_height - margin - y
    seat_width = min(90, avail_w / max_col)
    seat_height = min(60, avail_h / max_row)
    start_x = margin + (avail_w - seat_width * max_col) / 2
    font = max(5.0, min(8.0, seat_height / 6))

    for seat in seats:
        x = start_x + ((seat.column_number or 1) - 1) * seat_width
        sy = y + ((seat.row_number or 1) - 1) * seat_height
        student = assignments.get(str(seat.id))

        if seat.status != "AVAILABLE" or not seat.is_usable:
            fill, label = (0.9, 0.9, 0.9), "Not in use"
        elif student:
            fill, label = (0.88, 0.95, 0.88), None
        else:
            fill, label = (1, 1, 1), "Empty"

        box = pymupdf.Rect(x + 1.5, sy + 1.5, x + seat_width - 1.5, sy + seat_height - 1.5)
        page.draw_rect(box, color=(0, 0, 0), fill=fill, width=0.6)
        if student:
            body = (f"<b>{html.escape(seat.seat_code)}</b><br>{html.escape(student.full_name)}"
                    f'<br><span style="color:#555">{html.escape(student.student_number)}</span>')
        else:
            body = f'<b>{html.escape(seat.seat_code)}</b><br><span style="color:#777">{label}</span>'
        page.insert_htmlbox(
            box + (3, 2, -2, -1), body,
            css=f"* {{font-family: sans-serif; font-size: {font}pt; line-height: 1.15;}}", scale_low=0.5,
        )

    doc.subset_fonts()
    data = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return data


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
    doc_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id, *paper_state.UP_TO_DATE
    ).scalar() or 0

    page_width, page_height = 612, 792
    margin = 50

    doc = pymupdf.open()
    page = doc.new_page(width=page_width, height=page_height)
    y = margin

    page.insert_text(pymupdf.Point(margin, y), "EXAM ADMINISTRATION SUMMARY", fontsize=16, color=(0, 0, 0))
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
        ("Generated", utcnow().strftime("%Y-%m-%d %H:%M UTC")),
    ]

    for label, value in lines:
        if label:
            page.insert_text(pymupdf.Point(margin, y), f"{label}:", fontsize=11, color=(0, 0, 0))
            page.insert_text(pymupdf.Point(margin + 180, y), value, fontsize=11, color=(0, 0, 0))
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
    # Out-of-date papers show the wrong seat or template, so they stay out of the package.
    generated = db.query(GeneratedExam).filter(
        GeneratedExam.exam_id == exam_id,
        *paper_state.UP_TO_DATE,
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
            f"Generated: {utcnow().isoformat()}\n"
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
