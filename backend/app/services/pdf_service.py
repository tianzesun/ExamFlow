import hashlib
import io
import os
import uuid
from uuid import UUID

import pymupdf
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.exam_assignment import ExamAssignment
from app.models.exam_student import ExamStudent
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student

MARGIN_TOP = 50
MARGIN_LEFT = 50


def _draw_header(
    page: pymupdf.Page,
    exam: Exam,
    student: Student,
    room: Room,
    seat: Seat,
) -> None:
    rect = page.rect
    y = MARGIN_TOP

    # Exam title line
    title = f"{exam.course_code} — {exam.exam_name}"
    page.insert_text(pymupdf.Point(MARGIN_LEFT, y), title, fontsize=14, color=(0, 0, 0))
    y += 20

    # Student name
    name_text = f"Student Name: {student.full_name}"
    page.insert_text(pymupdf.Point(MARGIN_LEFT, y), name_text, fontsize=11, color=(0, 0, 0))
    y += 16

    # Student ID
    id_text = f"Student ID: {student.student_number}"
    page.insert_text(pymupdf.Point(MARGIN_LEFT, y), id_text, fontsize=11, color=(0, 0, 0))
    y += 16

    # Room and Seat on same line
    room_seat = f"Room: {room.building} {room.room_number}    Seat: {seat.seat_code}"
    page.insert_text(pymupdf.Point(MARGIN_LEFT, y), room_seat, fontsize=11, color=(0, 0, 0))

    # Horizontal separator line
    y += 20
    page.draw_line(pymupdf.Point(MARGIN_LEFT, y), pymupdf.Point(rect.width - MARGIN_LEFT, y), color=(0, 0, 0), width=0.5)


def generate_one_student_pdf(
    template_bytes: bytes,
    exam: Exam,
    student: Student,
    room: Room,
    seat: Seat,
) -> bytes:
    doc = pymupdf.open(stream=template_bytes, filetype="pdf")

    if len(doc) == 0:
        doc.close()
        raise ValueError("Template PDF has no pages")

    page = doc[0]
    _draw_header(page, exam, student, room, seat)

    output = io.BytesIO()
    doc.save(output)
    doc.close()
    output.seek(0)
    return output.read()


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

    for assignment, student, seat, room in assignments:
        try:
            pdf_bytes = generate_one_student_pdf(template_bytes, exam, student, room, seat)
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
                created_by=user_id,
            )
            generated_objects.append(ge)
            generated_count += 1
        except Exception:
            failed_count += 1
            if not failed_student:
                failed_student = student.student_number

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

    # All succeeded — commit
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
        .filter(GeneratedExam.exam_id == exam_id)
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
            "template_version": tmpl.version if tmpl else None,
            "created_at": ge.created_at.isoformat() if ge.created_at else None,
        }
        for ge, s, tmpl in results
    ], total


def get_generated_exam(db: Session, generated_exam_id: UUID) -> GeneratedExam | None:
    return db.query(GeneratedExam).filter(GeneratedExam.id == generated_exam_id).first()
