"""Papers, QR verification, exam-day downloads, deletion and archive rules."""

import uuid

import pymupdf

from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, _create_room, client


def _pdf_bytes() -> bytes:
    doc = pymupdf.open()
    doc.new_page()
    data = doc.tobytes()
    doc.close()
    return data


def _ready_exam_with_papers(student_count: int = 2) -> tuple[str, str]:
    exam_id, room_id, _ = _create_exam_with_students(student_count=student_count, capacity=10)
    # Exam names in the wild look like "CODE — Course name"; the dash must survive downloads.
    client.patch(f"/api/exams/{exam_id}", json={"exam_name": "TEST — Final"}, headers=ADMIN_HEADERS)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    r = client.post(
        f"/api/exams/{exam_id}/templates",
        files={"file": ("paper.pdf", _pdf_bytes(), "application/pdf")},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 201, r.text
    r = client.post(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    return exam_id, room_id


def _papers(exam_id: str) -> list[dict]:
    return client.get(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).json()["exams"]


def test_generated_papers_carry_qr_and_download():
    exam_id, _ = _ready_exam_with_papers()
    papers = _papers(exam_id)
    assert len(papers) == 2 and all(p["has_qr"] for p in papers)

    r = client.get(f"/api/exams/{exam_id}/generated/{papers[0]['id']}/download", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_regenerating_supersedes_old_papers_and_their_qr():
    exam_id, _ = _ready_exam_with_papers()
    from app.database import SessionLocal
    from app.models.generated_exam import GeneratedExam

    db = SessionLocal()
    try:
        old_token = db.query(GeneratedExam.qr_token).filter(GeneratedExam.exam_id == uuid.UUID(exam_id)).first()[0]
    finally:
        db.close()
    assert client.get(f"/api/verify/{old_token}").json()["valid"] is True

    client.post(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS)
    assert len(_papers(exam_id)) == 2  # only the current set is listed
    summary = client.get(f"/api/exams/{exam_id}/summary", headers=ADMIN_HEADERS).json()
    assert summary["generated_count"] == 2
    assert client.get(f"/api/verify/{old_token}").json()["valid"] is False


def test_room_documents_and_package_download():
    exam_id, room_id = _ready_exam_with_papers()
    for kind in ("signature-list", "seating-map"):
        r = client.get(f"/api/exams/{exam_id}/{kind}/{room_id}", headers=ADMIN_HEADERS)
        assert r.status_code == 200, kind
        assert r.content.startswith(b"%PDF") and len(r.content) > 500, kind

    r = client.get(f"/api/exams/{exam_id}/package/download", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"
    assert "filename*=UTF-8''" in r.headers["content-disposition"]


def test_roster_import_tolerates_duplicate_rows():
    exam_id, _, _ = _create_exam_with_students(student_count=0, capacity=5)
    n = f"7{uuid.uuid4().int % 10**8:08d}"
    csv_text = f"student_number,name\n{n},Dup Person\n{n},Dup Person\n"
    r = client.post(
        f"/api/exams/{exam_id}/roster/import/confirm",
        files={"file": ("roster.csv", csv_text, "text/csv")},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"imported": 1, "skipped": 1}


def test_archived_exam_is_read_only():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    assert client.patch(f"/api/exams/{exam_id}", json={"status": "ARCHIVED"}, headers=ADMIN_HEADERS).status_code == 200
    r = client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    assert r.status_code == 409
    assert client.patch(f"/api/exams/{exam_id}", json={"exam_name": "x"}, headers=ADMIN_HEADERS).status_code == 400
    # Reading still works.
    assert client.get(f"/api/exams/{exam_id}/roster", headers=ADMIN_HEADERS).status_code == 200


def test_delete_exam_and_course():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    course_id = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["course_id"]

    assert client.delete(f"/api/courses/{course_id}", headers=ADMIN_HEADERS).status_code == 409  # still has an exam
    assert client.delete(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).status_code == 204
    assert client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).status_code == 404
    assert client.delete(f"/api/courses/{course_id}", headers=ADMIN_HEADERS).status_code == 204


def test_room_in_use_cannot_be_deleted_and_usage_reports_it():
    exam_id, room_id, _ = _create_exam_with_students(student_count=3, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)

    usage = client.get("/api/rooms/usage", headers=ADMIN_HEADERS).json()[room_id]
    assert usage["seats"] == 10 and usage["peak_assigned"] == 3 and usage["upcoming_exams"] == 1

    assert client.delete(f"/api/rooms/{room_id}", headers=ADMIN_HEADERS).status_code == 409
    spare = _create_room(5)
    assert client.delete(f"/api/rooms/{spare['id']}", headers=ADMIN_HEADERS).status_code == 204


def test_ttb_requires_sign_in():
    assert client.post("/api/ttb/sync").status_code in (401, 403)
    assert client.get("/api/ttb/reference-data").status_code in (401, 403)
