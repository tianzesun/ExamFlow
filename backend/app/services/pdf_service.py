import hashlib
import html
import io
import os
import secrets
import uuid
from collections.abc import Callable
from types import SimpleNamespace
from uuid import UUID

import pymupdf
import qrcode
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
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
from app.services import assignment_service, paper_state
from app.services.paper_state import exam_title
from app.services.settings_service import PaperStamp, get_system_settings
from app.utils import utcnow

MARGIN = 36
# Band reserved at the top of each page for the student's details.
FIRST_BAND = 78
OTHER_BAND = 22
QR_SIZE = 58
# Clearance kept between the stamp and the paper's own content.
CONTENT_GAP = 4

_CSS = "* {font-family: sans-serif; margin: 0; padding: 0;} b {font-weight: bold; color: inherit;}"


def write_text(page: pymupdf.Page, rect: pymupdf.Rect, text: str, size: float = 10,
               bold: bool = False, align: str = "left", grey: bool = False, colour: str | None = None) -> None:
    """Write one line of text, falling back to other fonts for accents and non-Latin names.

    The base-14 fonts used by insert_text can't show names like Nguyễn or 李华.
    """
    content = html.escape(text)
    if bold:
        content = f"<b>{content}</b>"
    colour = colour or ("#555" if grey else "#000")
    html_text = f'<p style="font-size:{size}pt; text-align:{align}; color:{colour}">{content}</p>'
    spare, _ = page.insert_htmlbox(rect, html_text, css=_CSS, scale_low=0.5)
    if spare < 0:
        # Too long even at half size; nothing was written. A paper must never lose its room or seat,
        # so shrink as far as it takes.
        page.insert_htmlbox(rect, html_text, css=_CSS, scale_low=0)


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


def _place_pages(template: pymupdf.Document, every_page: bool = True) -> pymupdf.Document:
    """Copy the paper, keeping room for the stamp at the top of every stamped page.

    A page with an empty top margin is copied as is; otherwise its content is
    scaled down just enough to clear the band, so nothing is ever printed over.
    """
    out = pymupdf.open()
    for i, page in enumerate(template):
        band = FIRST_BAND if i == 0 else OTHER_BAND if every_page else 0
        if not band:
            out.insert_pdf(template, from_page=i, to_page=i)
            continue
        if _content_top(page) >= band + CONTENT_GAP:
            out.insert_pdf(template, from_page=i, to_page=i)
        else:
            w, h = page.rect.width, page.rect.height
            target = out.new_page(width=w, height=h)
            target.show_pdf_page(pymupdf.Rect(0, band + CONTENT_GAP, w, h), template, i)
    return out


def _who(student: Student, stamp: PaperStamp) -> tuple[str, str]:
    """The large line naming the student, and the smaller line under it."""
    utorid = getattr(student, "utorid", None)
    details = [f"Student number: {student.student_number}"] if stamp.show_name else []
    if stamp.show_utorid and utorid:
        details.append(f"UTORid: {utorid}")
    main = student.full_name if stamp.show_name else f"Student number {student.student_number}"
    return main, " · ".join(details)


def _stamp_first_page(page: pymupdf.Page, exam: Exam, student: Student, room: Room, seat: Seat,
                      qr_token: str | None, paper_version: str | None = None,
                      stamp: PaperStamp | None = None) -> None:
    stamp = stamp or PaperStamp()
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
    if paper_version:
        # A large letter so proctors can hand out versions without reading names.
        badge = pymupdf.Rect(box.x0 - 54, box.y0, box.x0 - 8, box.y1)
        page.draw_rect(badge, color=(0, 0, 0), fill=(0, 0, 0), width=1)
        write_text(page, pymupdf.Rect(badge.x0, badge.y0 + 5, badge.x1, badge.y0 + 15), "VERSION", 6,
                   align="center", colour="#fff")
        write_text(page, pymupdf.Rect(badge.x0, badge.y0 + 14, badge.x1, badge.y1 - 2), paper_version, 26,
                   bold=True, align="center", colour="#fff")
        text_right = badge.x0 - 10
    write_text(page, pymupdf.Rect(MARGIN, top, text_right, top + 16), exam_title(exam), 9, grey=True)
    main, details = _who(student, stamp)
    write_text(page, pymupdf.Rect(MARGIN, top + 14, text_right, top + 40), main, 15, bold=True)
    if details:
        write_text(page, pymupdf.Rect(MARGIN, top + 40, text_right, top + 56), details, 10)

    y = FIRST_BAND - 2
    page.draw_line(pymupdf.Point(MARGIN, y), pymupdf.Point(w - MARGIN, y), color=(0, 0, 0), width=0.75)


def _stamp_other_page(page: pymupdf.Page, student: Student, room: Room, seat: Seat, number: int, total: int,
                      paper_version: str | None = None, stamp: PaperStamp | None = None) -> None:
    """A slim line so a page that comes loose can be matched to its student."""
    stamp = stamp or PaperStamp()
    w = page.rect.width
    utorid = getattr(student, "utorid", None)
    parts = [student.full_name] if stamp.show_name else []
    parts.append(student.student_number)
    if stamp.show_utorid and utorid:
        parts.append(utorid)
    parts += [f"{room.building} {room.room_number}", f"Seat {seat.seat_code}"]
    if paper_version:
        parts.append(f"Version {paper_version}")
    write_text(page, pymupdf.Rect(MARGIN, 6, w - MARGIN - 80, 18), " · ".join(parts), 8)
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
    paper_version: str | None = None,
    stamp: PaperStamp | None = None,
) -> bytes:
    """Stamp the template for one student. paper_version is printed only when the exam has several;
    stamp says what else to print (Admin › Settings)."""
    stamp = stamp or PaperStamp()
    template = pymupdf.open(stream=template_bytes, filetype="pdf")
    try:
        if len(template) == 0:
            raise ValueError("Template PDF has no pages")
        doc = _place_pages(template, stamp.every_page)
    finally:
        template.close()

    try:
        _stamp_first_page(doc[0], exam, student, room, seat, qr_token, paper_version, stamp)
        for i in range(1, len(doc) if stamp.every_page else 1):
            _stamp_other_page(doc[i], student, room, seat, i + 1, len(doc), paper_version, stamp)
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

    # Every version students are seated for needs its own uploaded paper.
    needed = sorted(
        {v for (v,) in db.query(ExamAssignment.paper_version).filter(ExamAssignment.exam_id == exam_id).distinct()}
        or {"A"}
    )
    for version in needed:
        template = db.query(ExamTemplate).filter(
            ExamTemplate.exam_id == exam_id,
            ExamTemplate.paper_version == version,
            ExamTemplate.is_active == True,  # noqa: E712
        ).first()
        label = f" for version {version}" if needed != ["A"] else ""
        if not template:
            errors.append(f"No exam paper uploaded{label}" if label else "No exam paper uploaded")
            return errors
        template_path = os.path.join(
            "storage", "exams", str(exam_id), "templates", template.stored_filename
        )
        if not os.path.exists(template_path):
            errors.append(f"Template file not found on disk{label}")
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


def _load_active_template(db: Session, exam_id: UUID, paper_version: str = "A") -> tuple[ExamTemplate, bytes]:
    template = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.paper_version == paper_version,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()
    if not template:
        raise ValueError(
            "No exam paper uploaded" if paper_version == "A" else f"No exam paper uploaded for version {paper_version}"
        )

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
    return template, template_bytes


def preview_paper(db: Session, exam_id: UUID) -> bytes:
    """The active template stamped for a made-up student, to check the layout before generating.

    Uses the exam's first room and seat when there is one. Every page is watermarked
    SAMPLE and the QR code doesn't verify, so a preview can't pass for a real paper.
    """
    from app.services.admin_service import seat_order

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")
    _, template_bytes = _load_active_template(db, exam_id)

    room = (
        db.query(Room).join(ExamRoom, ExamRoom.room_id == Room.id)
        .filter(ExamRoom.exam_id == exam_id).order_by(Room.building, Room.room_number).first()
    )
    seats = db.query(Seat).filter(Seat.room_id == room.id, Seat.is_usable).all() if room else []
    seat = min(seats, key=seat_order) if seats else SimpleNamespace(seat_code="A01")
    room = room or SimpleNamespace(building="Room", room_number="TBD")
    # A long name shows whether the stamp has room for real ones.
    student = SimpleNamespace(full_name="Alexandra Sample-Studentname", student_number="1000000000",
                              utorid="samplea1")

    version = "A" if assignment_service.get_rules(db, exam_id).versions > 1 else None
    stamp = get_system_settings(db).paper_stamp
    doc = pymupdf.open(stream=generate_one_student_pdf(template_bytes, exam, student, room, seat, "preview", version,
                                                       stamp), filetype="pdf")
    try:
        for page in doc:
            centre = pymupdf.Point(page.rect.width / 2, page.rect.height / 2)
            page.insert_text(
                centre + (-170, 40), "SAMPLE", fontsize=120, color=(0.85, 0.2, 0.2), fill_opacity=0.18,
                morph=(centre, pymupdf.Matrix(-35)),
            )
        return doc.tobytes(garbage=3, deflate=True)
    finally:
        doc.close()


def generate_all_exams(
    db: Session,
    exam_id: UUID,
    user_id: UUID,
    on_progress: Callable[[int, int], None] | None = None,
    only_changed: bool = False,
) -> dict:
    """Generate personalized papers.

    With only_changed, papers that are still up to date are left alone, so their
    printed copies and QR codes stay valid; only missing and out-of-date papers are made.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")

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
    if only_changed:
        current = paper_state.up_to_date_student_ids(db, exam_id)
        assignments = [row for row in assignments if row[0].exam_student_id not in current]
        if not assignments:
            raise ValueError("Every paper is already up to date")

    templates = {v: _load_active_template(db, exam_id, v) for v in sorted({a.paper_version for a, *_ in assignments})}
    # Print the version only when the exam has several, so single-version papers look as before.
    show_version = paper_state.shows_version(db, exam_id)
    stamp = get_system_settings(db).paper_stamp

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
            template, template_bytes = templates[assignment.paper_version]
            pdf_bytes = generate_one_student_pdf(template_bytes, exam, student, room, seat, qr_token,
                                                 assignment.paper_version if show_version else None, stamp)
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
                seat_id=seat.id,
                file_name=file_name,
                storage_key=filepath,
                file_size=len(pdf_bytes),
                file_hash=file_hash,
                status="GENERATED",
                generation_version=new_version,
                version_shown=show_version,
                stamp_style=stamp.fingerprint(),
                exam_title=exam_title(exam),
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

    def remove_written_files() -> None:
        for ge in generated_objects:
            if os.path.exists(ge.storage_key):
                os.remove(ge.storage_key)

    # Check for failures
    if failed_count > 0:
        remove_written_files()
        raise ValueError(
            f"Generation failed for {failed_count} student(s). "
            f"First failure near student: {failed_student}"
        )

    # All succeeded — retire the papers these replace so counts, packages and QR checks see one
    # current paper per student. A full run replaces every paper, including those of students
    # who no longer have a seat.
    replaced = db.query(GeneratedExam).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.status == "GENERATED",
    )
    if only_changed:
        replaced = replaced.filter(GeneratedExam.exam_student_id.in_([a.exam_student_id for a, *_ in assignments]))
    replaced.update({"status": "SUPERSEDED"}, synchronize_session=False)
    db.add_all(generated_objects)
    db.add(AuditLog(
        user_id=user_id,
        action="PERSONALIZED_EXAMS_GENERATION_COMPLETED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={
            "template_versions": {v: t.version for v, (t, _) in templates.items()},
            "assignment_version": assignments[0][0].version if assignments else 0,
            "generation_version": new_version,
            "count": len(generated_objects),
            "only_changed": only_changed,
        },
    ))
    try:
        db.commit()
    except Exception:
        # e.g. another run took the same generation version; its papers stand, ours were never saved.
        db.rollback()
        remove_written_files()
        raise

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
    outdated_only: bool = False,
) -> tuple[list[dict], int]:
    q = (
        db.query(GeneratedExam, Student, ExamTemplate, Seat, Room)
        .join(ExamStudent, GeneratedExam.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .outerjoin(ExamTemplate, GeneratedExam.exam_template_id == ExamTemplate.id)
        .outerjoin(Seat, GeneratedExam.seat_id == Seat.id)
        .outerjoin(Room, Seat.room_id == Room.id)
        .filter(GeneratedExam.exam_id == exam_id, GeneratedExam.status == "GENERATED")
    )

    if query:
        pattern = f"%{query}%"
        q = q.filter(
            (Student.student_number.ilike(pattern)) |
            (Student.full_name.ilike(pattern))
        )

    if outdated_only:
        q = q.filter(*paper_state.OUTDATED)

    total = q.count()
    current = paper_state.up_to_date_student_ids(db, exam_id)
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
            "room": f"{room.building} {room.room_number}" if room else None,
            "seat_code": seat.seat_code if seat else None,
            "up_to_date": ge.exam_student_id in current,
            "printed_at": ge.printed_at.isoformat() if ge.printed_at else None,
        }
        for ge, s, tmpl, seat, room in results
    ], total


def get_generated_exam(db: Session, generated_exam_id: UUID) -> GeneratedExam | None:
    return db.query(GeneratedExam).filter(GeneratedExam.id == generated_exam_id).first()


def build_print_file(
    db: Session,
    exam_id: UUID,
    user_id: UUID,
    room_id: UUID | None = None,
    double_sided: bool = False,
    only_new: bool = False,
) -> tuple[bytes, str]:
    """All current papers in one PDF, room by room in seat order, ready to send to a printer.

    Each room opens with a divider sheet so the stack can be split for proctors. When
    printing double-sided, a blank page is added after any paper with an odd page count
    so the next student's paper starts on a fresh sheet. Out-of-date papers are left out;
    with only_new, so are papers already sent to print.
    """
    from app.services.admin_service import seat_order

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")

    q = (
        db.query(GeneratedExam, Student, Seat, Room)
        .join(ExamStudent, GeneratedExam.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .join(Seat, GeneratedExam.seat_id == Seat.id)
        .join(Room, Seat.room_id == Room.id)
        .filter(GeneratedExam.exam_id == exam_id, *paper_state.UP_TO_DATE)
    )
    if only_new:
        q = q.filter(GeneratedExam.printed_at.is_(None))
    if room_id:
        q = q.filter(Seat.room_id == room_id)
    papers = sorted(q.all(), key=lambda r: (r[3].building, r[3].room_number, seat_order(r[2])))
    if not papers:
        raise ValueError("No papers to print for this selection." if only_new
                         else "No up-to-date papers for this selection. Generate papers first.")

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
            write_text(divider, pymupdf.Rect(72, 260, 540, 300), exam_title(exam), 16,
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

    # Archived exams are final, so a reprint is recorded in the audit log but doesn't touch the papers.
    if exam.status != "ARCHIVED":
        now = utcnow()
        for ge, *_ in papers:
            ge.printed_at = ge.printed_at or now

    db.add(AuditLog(
        user_id=user_id,
        action="PRINT_FILE_DOWNLOADED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={"room_id": str(room_id) if room_id else None, "papers": len(papers),
                    "double_sided": double_sided, "only_new": only_new},
    ))
    db.commit()

    scope = f"{papers[0][3].building}{papers[0][3].room_number}" if room_id else "all-rooms"
    if only_new:
        scope += "-new"
    return data, f"{exam.course_code}-{exam.exam_name}-papers-{scope}.pdf"
