import csv
import io
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam_student import ExamStudent
from app.models.student import Student


def parse_csv(file_content: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(file_content))
    rows = []
    for row in reader:
        normalized = {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items()}
        rows.append(normalized)
    return rows


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

        valid_rows += 1
        preview.append({
            "student_number": student_number,
            "full_name": display_name,
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

        student = db.query(Student).filter(Student.student_number == student_number).first()
        if not student:
            student = Student(
                student_number=student_number,
                full_name=display_name,
            )
            db.add(student)
            db.flush()

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


def remove_from_roster(db: Session, exam_id: UUID, student_id: UUID, user_id: UUID) -> bool:
    es = db.query(ExamStudent).filter(
        ExamStudent.exam_id == exam_id,
        ExamStudent.student_id == student_id,
    ).first()
    if not es:
        return False

    db.delete(es)
    db.add(AuditLog(
        user_id=user_id,
        action="STUDENT_REMOVED_FROM_ROSTER",
        entity_type="exam",
        entity_id=exam_id,
        old_values={"student_id": str(student_id)},
    ))
    db.commit()
    return True
