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


def test_import_accepts_short_and_long_rows():
    exam_id, _, _ = _create_exam_with_students(student_count=0, capacity=5)
    a, b = (f"8{uuid.uuid4().int % 10**8:08d}" for _ in range(2))
    csv_text = f"student_number,name,email\n{a},Short Row\n{b},Long Row,long@example.invalid,extra\n"
    response = client.post(
        f"/api/exams/{exam_id}/roster/import/confirm",
        files={"file": ("roster.csv", csv_text, "text/csv")},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200, response.text
    assert response.json()["imported"] == 2


def test_import_skips_values_too_long_for_the_roster():
    exam_id, _, _ = _create_exam_with_students(student_count=0, capacity=5)
    ok = f"8{uuid.uuid4().int % 10**8:08d}"
    csv_text = f"student_number,name\n{'1' * 60},Too Long\n{ok},Fine\n"
    files = {"file": ("roster.csv", csv_text, "text/csv")}
    preview = client.post(f"/api/exams/{exam_id}/roster/import/preview", files=files, headers=ADMIN_HEADERS).json()
    assert preview["valid_rows"] == 1 and "longer than 50" in preview["errors"][0]
    response = client.post(f"/api/exams/{exam_id}/roster/import/confirm", files=files, headers=ADMIN_HEADERS)
    assert response.status_code == 200, response.text
    assert response.json() == {"imported": 1, "skipped": 1}


def test_accommodation_notes_are_for_exam_office_staff_only():
    from tests.test_seat_map import INSTRUCTOR_HEADERS

    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    [student] = _roster(exam_id)
    r = client.put(
        f"/api/exams/{exam_id}/roster/{student['student_id']}/accommodation",
        json={"extra_time_minutes": 30, "accommodation_notes": "Separate room"},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200, r.text
    assert _roster(exam_id)[0]["accommodation_notes"] == "Separate room"
    roster = client.get(f"/api/exams/{exam_id}/roster", headers=INSTRUCTOR_HEADERS).json()["students"]
    assert roster[0]["accommodation_notes"] is None and roster[0]["extra_time_minutes"] == 30
