"""Paper versions: neighbours write different papers, each version from its own upload."""

import csv
import io
from types import SimpleNamespace
from unittest import mock

import pymupdf

from app.services import generation_job_service
from app.services.assignment_service import SeatingRules, version_for_seat
from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, client

_run_job = generation_job_service.run_job


def _seat(row: int, col: int):
    return SimpleNamespace(row_number=row, column_number=col)


def test_neighbours_get_different_versions():
    rules = SeatingRules(versions=2)
    v = lambda r, c: version_for_seat(_seat(r, c), rules)  # noqa: E731
    assert v(1, 1) != v(1, 2) and v(1, 1) != v(2, 1) and v(1, 1) == v(2, 2)

    # Checkerboard: the nearest students are diagonal, one row apart.
    rules = SeatingRules(versions=2, spacing="every_other_seat")
    assert version_for_seat(_seat(1, 1), rules) != version_for_seat(_seat(2, 2), rules)

    # One seat in four: the occupied seats form a grid two apart.
    rules = SeatingRules(versions=2, spacing="every_other_seat_and_row")
    assert version_for_seat(_seat(1, 1), rules) != version_for_seat(_seat(1, 3), rules)
    assert version_for_seat(_seat(1, 1), rules) != version_for_seat(_seat(3, 1), rules)

    assert version_for_seat(_seat(1, 2), SeatingRules()) == "A"
    assert {version_for_seat(_seat(1, c), SeatingRules(versions=3)) for c in range(1, 4)} == {"A", "B", "C"}


def _template(marker: str) -> bytes:
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 200), marker, fontsize=14)
    return doc.tobytes()


def _upload(exam_id: str, marker: str, version: str = "A"):
    r = client.post(
        f"/api/exams/{exam_id}/templates",
        files={"file": (f"{marker}.pdf", _template(marker), "application/pdf")},
        data={"paper_version": version},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _versioned_exam(students: int = 4) -> str:
    exam_id, _, _ = _create_exam_with_students(student_count=students, capacity=10)
    rules = {"order": "student_number", "spacing": "none", "accommodation_room_id": None, "versions": 2}
    assert client.put(f"/api/exams/{exam_id}/assignments/rules", json=rules, headers=ADMIN_HEADERS).status_code == 200
    assert client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    return exam_id


def _versions_by_student(exam_id: str) -> dict[str, str]:
    room = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()["rooms"][0]
    return {s["occupant"]["student_number"]: s["occupant"]["paper_version"] for s in room["seats"] if s["occupant"]}


def _generate(exam_id: str, only_changed: bool = True):
    queued = []
    with mock.patch.object(generation_job_service, "run_job", side_effect=queued.append):
        r = client.post(
            f"/api/exams/{exam_id}/generated/jobs", params={"only_changed": only_changed}, headers=ADMIN_HEADERS
        )
    for job_id in queued:
        _run_job(job_id)
    return r


def _paper_texts(exam_id: str) -> dict[str, str]:
    papers = client.get(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).json()["exams"]
    texts = {}
    for p in papers:
        r = client.get(f"/api/exams/{exam_id}/generated/{p['id']}/download", headers=ADMIN_HEADERS)
        texts[p["student_number"]] = pymupdf.open(stream=r.content)[0].get_text()
    return texts


def test_seats_alternate_versions():
    exam_id = _versioned_exam(students=4)
    seat_map = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()["rooms"][0]
    by_seat = {s["seat_code"]: s["occupant"]["paper_version"] for s in seat_map["seats"] if s["occupant"]}
    assert [by_seat[c] for c in ("A01", "A02", "A03", "A04")] == ["A", "B", "A", "B"]


def test_each_version_needs_its_own_paper_and_papers_use_it():
    exam_id = _versioned_exam(students=4)
    _upload(exam_id, "PAPER-ONE")
    r = client.get(f"/api/exams/{exam_id}/generated/validate", headers=ADMIN_HEADERS).json()
    assert not r["valid"] and "version B" in r["errors"][0]
    readiness = client.get(f"/api/exams/{exam_id}/readiness", headers=ADMIN_HEADERS).json()
    assert next(c for c in readiness["checks"] if c["name"] == "template")["status"] == "FAIL"

    _upload(exam_id, "PAPER-TWO", version="B")
    assert _generate(exam_id).status_code == 202, "both versions uploaded"
    versions = _versions_by_student(exam_id)
    for number, text in _paper_texts(exam_id).items():
        expected = "PAPER-ONE" if versions[number] == "A" else "PAPER-TWO"
        assert expected in text and "VERSION" in text, number

    r = client.get(f"/api/exams/{exam_id}/seating-list", params={"format": "csv"}, headers=ADMIN_HEADERS)
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert rows[0][-1] == "Version" and {row[-1] for row in rows[1:]} == {"A", "B"}


def test_new_upload_for_one_version_leaves_the_other_up_to_date():
    exam_id = _versioned_exam(students=4)
    _upload(exam_id, "PAPER-ONE")
    _upload(exam_id, "PAPER-TWO", version="B")
    _generate(exam_id)
    templates = client.get(f"/api/exams/{exam_id}/templates", headers=ADMIN_HEADERS).json()
    assert {t["paper_version"] for t in templates if t["is_active"]} == {"A", "B"}

    _upload(exam_id, "PAPER-ONE-FIXED")
    templates = client.get(f"/api/exams/{exam_id}/templates", headers=ADMIN_HEADERS).json()
    assert sorted((t["paper_version"], t["original_filename"]) for t in templates if t["is_active"]) == [
        ("A", "PAPER-ONE-FIXED.pdf"), ("B", "PAPER-TWO.pdf")]
    status = client.get(f"/api/exams/{exam_id}/generated/status", headers=ADMIN_HEADERS).json()
    assert (status["up_to_date"], status["outdated"]) == (2, 2)

    _generate(exam_id)
    versions = _versions_by_student(exam_id)
    for number, text in _paper_texts(exam_id).items():
        assert ("PAPER-ONE-FIXED" if versions[number] == "A" else "PAPER-TWO") in text


def test_single_version_papers_show_no_version():
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    _upload(exam_id, "ONLY-PAPER")
    _generate(exam_id)
    assert all("VERSION" not in t and "ONLY-PAPER" in t for t in _paper_texts(exam_id).values())
    r = client.get(f"/api/exams/{exam_id}/seating-list", params={"format": "csv"}, headers=ADMIN_HEADERS)
    assert "Version" not in r.content.decode("utf-8-sig").splitlines()[0]


def test_bad_version_letter_is_rejected():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    r = client.post(
        f"/api/exams/{exam_id}/templates",
        files={"file": ("x.pdf", _template("X"), "application/pdf")},
        data={"paper_version": "E"},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 422
    rules = {"order": "student_number", "spacing": "none", "accommodation_room_id": None, "versions": 5}
    assert client.put(f"/api/exams/{exam_id}/assignments/rules", json=rules, headers=ADMIN_HEADERS).status_code == 422


def test_switching_to_several_versions_dates_every_paper():
    exam_id, _, _ = _create_exam_with_students(student_count=4, capacity=10)
    assert client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    _upload(exam_id, "PAPER-ONE")
    _generate(exam_id)
    assert all("VERSION" not in t for t in _paper_texts(exam_id).values())

    rules = {"order": "student_number", "spacing": "none", "accommodation_room_id": None, "versions": 2}
    assert client.put(f"/api/exams/{exam_id}/assignments/rules", json=rules, headers=ADMIN_HEADERS).status_code == 200
    assert client.post(f"/api/exams/{exam_id}/assignments/regenerate", headers=ADMIN_HEADERS).status_code == 200
    _upload(exam_id, "PAPER-TWO", version="B")
    status = client.get(f"/api/exams/{exam_id}/generated/status", headers=ADMIN_HEADERS).json()
    assert status["up_to_date"] == 0

    _generate(exam_id)
    assert all("VERSION" in t for t in _paper_texts(exam_id).values())


def test_template_with_a_non_latin_name_downloads():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    r = client.post(
        f"/api/exams/{exam_id}/templates",
        files={"file": ("期末考试 Łódź.pdf", _template("X"), "application/pdf")},
        data={"paper_version": "A"},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 201, r.text
    r = client.get(f"/api/exams/{exam_id}/templates/{r.json()['id']}/download", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert "filename*=UTF-8''" in r.headers["content-disposition"]


def test_full_generation_waits_for_a_running_job():
    exam_id = _versioned_exam(students=2)
    _upload(exam_id, "PAPER-ONE")
    _upload(exam_id, "PAPER-TWO", version="B")
    with mock.patch.object(generation_job_service, "run_job"):
        assert client.post(f"/api/exams/{exam_id}/generated/jobs", headers=ADMIN_HEADERS).status_code == 202
    assert client.post(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).status_code == 409


def test_readiness_fails_when_the_paper_file_is_gone():
    import os

    from app.database import SessionLocal
    from app.models.exam_template import ExamTemplate
    from app.services.template_service import get_template_path

    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    template_id = _upload(exam_id, "PAPER-ONE")["id"]
    with SessionLocal() as db:
        os.remove(get_template_path(db.get(ExamTemplate, template_id)))
    readiness = client.get(f"/api/exams/{exam_id}/readiness", headers=ADMIN_HEADERS).json()
    check = next(c for c in readiness["checks"] if c["name"] == "template")
    assert check["status"] == "FAIL" and "missing" in check["message"]
