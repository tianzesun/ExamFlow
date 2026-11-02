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
    assert r.json() == {"imported": 1, "skipped": 1, "removed": 0}


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


def test_room_with_students_seated_for_an_upcoming_exam_cannot_be_switched_off():
    exam_id, room_id, _ = _create_exam_with_students(student_count=2, capacity=10)
    assert client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    r = client.patch(f"/api/rooms/{room_id}", json={"is_active": False}, headers=ADMIN_HEADERS)
    assert r.status_code == 409 and "Move them to another room" in r.json()["detail"]
    assert client.get(f"/api/rooms/{room_id}", headers=ADMIN_HEADERS).json()["is_active"] is True

    spare = _create_room(5)  # a room nobody is seated in switches off as before
    assert client.patch(f"/api/rooms/{spare['id']}", json={"is_active": False},
                        headers=ADMIN_HEADERS).status_code == 200


def test_room_documents_need_one_of_the_exams_rooms():
    exam_id, _ = _ready_exam_with_papers()
    other_room = _create_room(5)
    for kind in ("signature-list", "seating-map"):
        assert client.get(f"/api/exams/{exam_id}/{kind}/{other_room['id']}", headers=ADMIN_HEADERS).status_code == 404
        missing_exam = f"/api/exams/{uuid.uuid4()}/{kind}/{other_room['id']}"
        assert client.get(missing_exam, headers=ADMIN_HEADERS).status_code == 404


def test_package_folder_names_are_safe():
    import io
    import zipfile

    exam_id, room_id = _ready_exam_with_papers()
    client.patch(f"/api/rooms/{room_id}", json={"building": "../../X"}, headers=ADMIN_HEADERS)
    # Renaming the room dates the papers, so make them again with the new name.
    assert client.post(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).status_code == 200
    r = client.get(f"/api/exams/{exam_id}/package/download", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert not any(".." in n or n.startswith("/") for n in names), names
    assert any(n.endswith("/Signature-List.pdf") for n in names)


def test_null_in_an_update_is_refused_not_a_server_error():
    exam_id, _ = _ready_exam_with_papers()
    for field in ("exam_name", "exam_date", "duration_minutes"):
        r = client.patch(f"/api/exams/{exam_id}", json={field: None}, headers=ADMIN_HEADERS)
        assert r.status_code == 422, field
    assert client.patch(f"/api/exams/{exam_id}", json={"notes": None}, headers=ADMIN_HEADERS).status_code == 200
    r = client.patch(f"/api/exams/{exam_id}", json={"start_time": "09:00:00-05:00"}, headers=ADMIN_HEADERS)
    assert r.status_code == 422


def test_renaming_a_course_renames_its_exams():
    exam_id, _ = _ready_exam_with_papers()
    course_id = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["course_id"]
    code = f"REN {uuid.uuid4().hex[:6].upper()}"
    r = client.patch(f"/api/courses/{course_id}", json={"course_code": code, "course_name": "Renamed"},
                     headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    r = client.patch(f"/api/courses/{course_id}", json={"course_code": None}, headers=ADMIN_HEADERS)
    assert r.status_code == 422
    exam = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()
    assert (exam["course_code"], exam["course_name"]) == (code, "Renamed")


def test_server_errors_carry_a_reference_the_browser_can_read():
    from unittest import mock

    from app.services import exam_service

    with mock.patch.object(exam_service, "get_exam", side_effect=RuntimeError("boom")):
        r = client.get(f"/api/exams/{uuid.uuid4()}", headers={**ADMIN_HEADERS, "Origin": "http://localhost:3000"})
    assert r.status_code == 500
    assert r.headers["x-request-id"] and r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "boom" not in r.text


def test_every_exam_document_download_is_recorded():
    exam_id, room_id = _ready_exam_with_papers()
    paper = _papers(exam_id)[0]
    template = client.get(f"/api/exams/{exam_id}/templates", headers=ADMIN_HEADERS).json()[0]
    for path in (
        f"/generated/{paper['id']}/download", f"/templates/{template['id']}/download",
        f"/signature-list/{room_id}", f"/seating-map/{room_id}", "/seating-list", "/seating-list?format=csv",
    ):
        assert client.get(f"/api/exams/{exam_id}{path}", headers=ADMIN_HEADERS).status_code == 200, path

    entries = client.get("/api/admin/activity", params={"page_size": 200}, headers=ADMIN_HEADERS).json()["entries"]
    mine = [e for e in entries if e["entity_id"] == exam_id and e["action"].endswith("_DOWNLOADED")]
    actions = sorted(e["action"] for e in mine)
    assert actions.count("PAPER_DOWNLOADED") == 1 and actions.count("TEMPLATE_DOWNLOADED") == 1
    documents = sorted(e["new_values"]["document"] for e in mine if e["action"] == "EXAM_DAY_DOCUMENT_DOWNLOADED")
    assert documents == ["seating list", "seating list", "seating map", "signature list"]
    room_entry = next(e for e in mine if e["new_values"].get("document") == "signature list")
    assert room_entry["new_values"]["room"] and room_entry["user"]["name"] == "Dev Admin"
