import csv
import io
import os
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam_assignment import ExamAssignment
from app.models.exam_student import ExamStudent
from app.models.generated_exam import GeneratedExam
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student
from app.utils import utcnow


def parse_csv(file_content: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(file_content))
    rows = []
    for row in reader:
        # Short rows give None values and long rows put the extras under a None key.
        normalized = {k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in row.items() if k}
        rows.append(normalized)
    return rows


# Column sizes on the students table.
FIELD_LIMITS = {"student_number": 50, "name": 255, "utorid": 50, "email": 255}


def _too_long(**values: str | None) -> str | None:
    """The first field longer than its column allows, if any."""
    return next((f for f, v in values.items() if v and len(v) > FIELD_LIMITS[f]), None)


def preview_roster_import(db: Session, exam_id: UUID, file_content: str) -> dict:
    rows = parse_csv(file_content)

    errors = []
    seen_numbers = set()
    duplicate_in_file = 0
    already_in_roster = 0
    valid_rows = 0
    preview = []

    existing_student_ids = {
        es.student_id
        for es in db.query(ExamStudent.student_id).filter(ExamStudent.exam_id == exam_id).all()
    }
    existing_student_numbers = {
        s.student_number
        for s in db.query(Student.student_number)
        .filter(Student.id.in_(existing_student_ids))
        .all()
    }

    for i, row in enumerate(rows, start=2):
        student_number = row.get("student_number", "")
        first_name = row.get("first_name", "")
        last_name = row.get("last_name", "")
        name = row.get("name", "")

        if not student_number:
            errors.append(f"Row {i}: Missing student_number")
            continue

        if student_number in seen_numbers:
            duplicate_in_file += 1
            continue
        seen_numbers.add(student_number)

        if student_number in existing_student_numbers:
            already_in_roster += 1
            continue

        display_name = name or f"{first_name} {last_name}".strip()
        if not display_name:
            errors.append(f"Row {i}: Missing name (provide name or first_name + last_name)")
            continue
        field = _too_long(student_number=student_number, name=display_name,
                          utorid=row.get("utorid"), email=row.get("email"))
        if field:
            errors.append(f"Row {i}: {field} is longer than {FIELD_LIMITS[field]} characters")
            continue

        valid_rows += 1
        preview.append({
            "student_number": student_number,
            "full_name": display_name,
            "utorid": row.get("utorid") or None,
            "email": row.get("email") or None,
        })

    return {
        "total_rows": len(rows),
        "valid_rows": valid_rows,
        "duplicate_in_file": duplicate_in_file,
        "already_in_roster": already_in_roster,
        "new_students": valid_rows,
        "errors": errors,
        "preview": preview[:10],
    }


def import_roster(db: Session, exam_id: UUID, file_content: str, user_id: UUID) -> dict:
    rows = parse_csv(file_content)
    imported = 0
    skipped = 0

    existing_student_ids = {
        es.student_id
        for es in db.query(ExamStudent.student_id).filter(ExamStudent.exam_id == exam_id).all()
    }
    existing_student_numbers = {
        s.student_number
        for s in db.query(Student.student_number)
        .filter(Student.id.in_(existing_student_ids))
        .all()
    }

    for row in rows:
        student_number = row.get("student_number", "").strip()
        first_name = row.get("first_name", "").strip()
        last_name = row.get("last_name", "").strip()
        name = row.get("name", "").strip()

        if not student_number:
            skipped += 1
            continue

        display_name = name or f"{first_name} {last_name}".strip()
        if not display_name:
            skipped += 1
            continue

        if student_number in existing_student_numbers:
            skipped += 1
            continue

        utorid = row.get("utorid", "").strip().lower() or None
        email = row.get("email", "").strip() or None
        if _too_long(student_number=student_number, name=display_name, utorid=utorid, email=email):
            skipped += 1
            continue
        if utorid and db.query(Student.id).filter(
            Student.utorid == utorid, Student.student_number != student_number
        ).first():
            # UTORids are unique; don't let a bad row attach one to the wrong student.
            utorid = None

        student = db.query(Student).filter(Student.student_number == student_number).first()
        if not student:
            student = Student(
                student_number=student_number,
                full_name=display_name,
                utorid=utorid,
                email=email,
            )
            db.add(student)
            db.flush()
        else:
            # Fill in contact details we didn't have before; never overwrite existing ones.
            student.utorid = student.utorid or utorid
            student.email = student.email or email
            db.flush()
        existing_student_numbers.add(student_number)

        exam_student = ExamStudent(
            exam_id=exam_id,
            student_id=student.id,
        )
        db.add(exam_student)
        imported += 1

    db.add(AuditLog(
        user_id=user_id,
        action="ROSTER_IMPORTED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={"imported": imported, "skipped": skipped},
    ))
    db.commit()

    return {"imported": imported, "skipped": skipped}


def get_roster(db: Session, exam_id: UUID, page: int = 1, page_size: int = 50) -> tuple[list, int]:
    query = (
        db.query(ExamStudent, Student)
        .join(Student, ExamStudent.student_id == Student.id)
        .filter(ExamStudent.exam_id == exam_id)
    )
    total = query.count()
    results = (
        query
        .order_by(Student.student_number)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return results, total


def seats_for(db: Session, exam_student_ids: list[UUID]) -> dict[UUID, tuple[str, str]]:
    """Room label and seat code for each seated student."""
    if not exam_student_ids:
        return {}
    rows = (
        db.query(ExamAssignment.exam_student_id, Room.building, Room.room_number, Seat.seat_code)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .join(Room, Seat.room_id == Room.id)
        .filter(ExamAssignment.exam_student_id.in_(exam_student_ids))
    )
    return {es_id: (f"{building} {number}", code) for es_id, building, number, code in rows}


def remove_from_roster(db: Session, exam_id: UUID, student_id: UUID, user_id: UUID) -> bool:
    es = db.query(ExamStudent).filter(
        ExamStudent.exam_id == exam_id,
        ExamStudent.student_id == student_id,
    ).first()
    if not es:
        return False

    # The papers go with the roster entry; their files hold the student's name, so remove them too. A printed
    # paper keeps a record without the student, so staff are told to take it out of the stack.
    papers = db.query(GeneratedExam).filter(GeneratedExam.exam_student_id == es.id).all()
    paper_files = [ge.storage_key for ge in papers]
    for ge in papers:
        if ge.printed_at and not ge.pulled_at:
            ge.exam_student_id = None
            ge.exam_assignment_id = None
            ge.status = "SUPERSEDED"
            ge.file_name = "withdrawn.pdf"
        else:
            db.delete(ge)
    db.flush()
    db.delete(es)
    db.add(AuditLog(
        user_id=user_id,
        action="STUDENT_REMOVED_FROM_ROSTER",
        entity_type="exam",
        entity_id=exam_id,
        old_values={"student_id": str(student_id)},
    ))
    db.commit()
    for path in paper_files:
        if os.path.exists(path):
            os.remove(path)
    return True


def _get_exam_student(db: Session, exam_id: UUID, student_id: UUID) -> ExamStudent | None:
    return db.query(ExamStudent).filter(
        ExamStudent.exam_id == exam_id,
        ExamStudent.student_id == student_id,
    ).first()


def set_attendance(
    db: Session, exam_id: UUID, student_id: UUID, attendance_status: str, user_id: UUID
) -> ExamStudent | None:
    es = _get_exam_student(db, exam_id, student_id)
    if not es:
        return None
    old_status = es.attendance_status
    es.attendance_status = attendance_status
    if attendance_status == "PRESENT":
        es.checked_in_at = utcnow()
        es.checked_in_by = user_id
    else:
        es.checked_in_at = None
        es.checked_in_by = None
    db.add(AuditLog(
        user_id=user_id,
        action="ATTENDANCE_RECORDED",
        entity_type="exam_student",
        entity_id=es.id,
        old_values={"attendance_status": old_status},
        new_values={"attendance_status": attendance_status},
    ))
    db.commit()
    db.refresh(es)
    return es


def set_accommodation(
    db: Session, exam_id: UUID, student_id: UUID, extra_time_minutes: int, notes: str | None, user_id: UUID
) -> ExamStudent | None:
    es = _get_exam_student(db, exam_id, student_id)
    if not es:
        return None
    old = {"extra_time_minutes": es.extra_time_minutes, "has_notes": bool(es.accommodation_notes)}
    es.extra_time_minutes = extra_time_minutes
    es.accommodation_notes = (notes or "").strip() or None
    # Accommodation details are sensitive; the audit trail records that they changed, not what they say.
    db.add(AuditLog(
        user_id=user_id,
        action="ACCOMMODATION_UPDATED",
        entity_type="exam_student",
        entity_id=es.id,
        old_values=old,
        new_values={"extra_time_minutes": es.extra_time_minutes, "has_notes": bool(es.accommodation_notes)},
    ))
    db.commit()
    db.refresh(es)
    return es


def attendance_summary(db: Session, exam_id: UUID) -> dict:
    rows = (
        db.query(ExamStudent.attendance_status, func.count(ExamStudent.id))
        .filter(ExamStudent.exam_id == exam_id)
        .group_by(ExamStudent.attendance_status)
        .all()
    )
    counts = {s: n for s, n in rows}
    return {
        "expected": counts.get("EXPECTED", 0),
        "present": counts.get("PRESENT", 0),
        "absent": counts.get("ABSENT", 0),
        "total": sum(counts.values()),
    }
