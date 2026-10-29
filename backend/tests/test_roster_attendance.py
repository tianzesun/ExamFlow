import uuid

from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models.exam import Exam
from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, client


def _roster(exam_id: str) -> list[dict]:
    return client.get(f"/api/exams/{exam_id}/roster", headers=ADMIN_HEADERS).json()["students"]


def test_import_keeps_utorid_and_email():
    exam_id, _, _ = _create_exam_with_students(student_count=0, capacity=5)
    n = f"8{uuid.uuid4().int % 10**8:08d}"
    utorid = f"zztest{uuid.uuid4().hex[:6]}"
    csv_text = f"student_number,name,utorid,email\n{n},Test Person,{utorid.upper()},test@example.invalid\n"
    response = client.post(
        f"/api/exams/{exam_id}/roster/import/confirm",
        files={"file": ("roster.csv", csv_text, "text/csv")},
        headers=ADMIN_HEADERS,
    )
    assert response.json()["imported"] == 1
    [entry] = _roster(exam_id)
    assert entry["utorid"] == utorid
    assert entry["email"] == "test@example.invalid"
    assert entry["attendance_status"] == "EXPECTED"


def test_attendance_check_in_and_summary():
    exam_id, _, _ = _create_exam_with_students(student_count=3, capacity=5)
    first, second, _ = _roster(exam_id)

    r = client.put(
        f"/api/exams/{exam_id}/roster/{first['student_id']}/attendance",
        json={"attendance_status": "PRESENT"},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200
    assert r.json()["checked_in_at"] is not None
    client.put(
        f"/api/exams/{exam_id}/roster/{second['student_id']}/attendance",
        json={"attendance_status": "ABSENT"},
        headers=ADMIN_HEADERS,
    )
    summary = client.get(f"/api/exams/{exam_id}/roster/attendance", headers=ADMIN_HEADERS).json()
    assert summary == {"expected": 1, "present": 1, "absent": 1, "total": 3}

    # Undoing a check-in clears the timestamp.
    r = client.put(
        f"/api/exams/{exam_id}/roster/{first['student_id']}/attendance",
        json={"attendance_status": "EXPECTED"},
        headers=ADMIN_HEADERS,
    )
    assert r.json()["checked_in_at"] is None


def test_attendance_rejects_unknown_status():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    [entry] = _roster(exam_id)
    r = client.put(
        f"/api/exams/{exam_id}/roster/{entry['student_id']}/attendance",
        json={"attendance_status": "LATE"},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 422


def test_accommodation_update():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    [entry] = _roster(exam_id)
    r = client.put(
        f"/api/exams/{exam_id}/roster/{entry['student_id']}/accommodation",
        json={"extra_time_minutes": 30, "accommodation_notes": "  Separate room  "},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200
    assert r.json()["extra_time_minutes"] == 30
    assert r.json()["accommodation_notes"] == "Separate room"


def test_exam_notes_round_trip():
    exam_id, _, _ = _create_exam_with_students(student_count=0, capacity=5)
    r = client.patch(f"/api/exams/{exam_id}", json={"notes": "Calculators allowed"}, headers=ADMIN_HEADERS)
    assert r.json()["notes"] == "Calculators allowed"


def test_database_rejects_invalid_exam_status():
    exam_id, _, _ = _create_exam_with_students(student_count=0, capacity=5)
    db = SessionLocal()
    try:
        exam = db.get(Exam, uuid.UUID(exam_id))
        exam.status = "BOGUS"
        try:
            db.commit()
            raise AssertionError("check constraint did not fire")
        except IntegrityError:
            db.rollback()
    finally:
        db.close()
