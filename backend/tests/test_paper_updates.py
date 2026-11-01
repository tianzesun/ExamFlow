"""Late changes: only papers that no longer match their seat or template are made again."""

import uuid
from unittest import mock

import pymupdf

from app.database import SessionLocal
from app.models.generated_exam import GeneratedExam
from app.services import generation_job_service
from tests.test_exam_day import _pdf_bytes, _ready_exam_with_papers
from tests.test_seat_map import ADMIN_HEADERS, _seat_map, _seat_of, client

_run_job = generation_job_service.run_job


def _update_papers(exam_id: str, only_changed: bool = True):
    """Start a job and run it after the request, as in test_generation_jobs."""
    queued = []
    with mock.patch.object(generation_job_service, "run_job", side_effect=queued.append):
        r = client.post(
            f"/api/exams/{exam_id}/generated/jobs", params={"only_changed": only_changed}, headers=ADMIN_HEADERS
        )
    for job_id in queued:
        _run_job(job_id)
    return r


def _status(exam_id: str) -> dict:
    r = client.get(f"/api/exams/{exam_id}/generated/status", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    return r.json()


def _current_papers(exam_id: str) -> dict[str, tuple[str, str]]:
    """student_number -> (paper id, qr token) for current papers."""
    db = SessionLocal()
    try:
        rows = db.query(GeneratedExam).filter(
            GeneratedExam.exam_id == uuid.UUID(exam_id), GeneratedExam.status == "GENERATED"
        ).all()
        by_paper = {str(ge.id): ge.qr_token for ge in rows}
    finally:
        db.close()
    listed = client.get(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).json()["exams"]
    return {p["student_number"]: (p["id"], by_paper[p["id"]]) for p in listed}


def _verifies(token: str) -> bool:
    return client.get(f"/api/verify/{token}").json()["valid"]


def _move(exam_id: str, student_number: str, seat_id: str) -> None:
    room = _seat_map(exam_id)
    student_id = _seat_of(room, student_number)["occupant"]["student_id"]
    r = client.post(
        f"/api/exams/{exam_id}/assignments/move",
        json={"student_id": student_id, "seat_id": seat_id},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200, r.text


def _exam_status(exam_id: str) -> str:
    return client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["status"]


def test_moving_a_student_only_regenerates_their_paper():
    exam_id, _ = _ready_exam_with_papers(student_count=3)
    before = _current_papers(exam_id)
    assert _status(exam_id)["to_generate"] == 0 and _exam_status(exam_id) == "GENERATED"

    moved = sorted(before)[0]
    empty = next(s for s in _seat_map(exam_id)["seats"] if not s["occupant"])
    _move(exam_id, moved, empty["id"])

    status = _status(exam_id)
    assert (status["up_to_date"], status["outdated"], status["to_generate"]) == (2, 1, 1)
    assert _exam_status(exam_id) == "READY"
    listed = client.get(f"/api/exams/{exam_id}/generated", params={"outdated_only": True}, headers=ADMIN_HEADERS)
    assert [p["student_number"] for p in listed.json()["exams"]] == [moved]

    assert _update_papers(exam_id).status_code == 202
    after = _current_papers(exam_id)
    assert _status(exam_id)["to_generate"] == 0 and _exam_status(exam_id) == "GENERATED"
    for number in before:
        if number == moved:
            assert after[number][0] != before[number][0]
            assert not _verifies(before[number][1]) and _verifies(after[number][1])
        else:
            assert after[number] == before[number]  # untouched; printed copies stay valid
            assert _verifies(after[number][1])

    paper = next(p for p in client.get(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).json()["exams"]
                 if p["student_number"] == moved)
    assert paper["seat_code"] == empty["seat_code"] and paper["up_to_date"]


def test_swap_regenerates_both_students():
    exam_id, _ = _ready_exam_with_papers(student_count=3)
    numbers = sorted(_current_papers(exam_id))
    room = _seat_map(exam_id)
    _move(exam_id, numbers[0], _seat_of(room, numbers[1])["id"])
    assert _status(exam_id)["to_generate"] == 2
    _update_papers(exam_id)
    assert _status(exam_id)["to_generate"] == 0


def test_late_student_gets_a_paper_without_touching_others():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    before = _current_papers(exam_id)
    late = f"8{uuid.uuid4().int % 10**8:08d}"
    r = client.post(
        f"/api/exams/{exam_id}/roster/import/confirm",
        files={"file": ("late.csv", f"student_number,first_name,last_name\n{late},Late,Student\n", "text/csv")},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200, r.text
    assert client.post(f"/api/exams/{exam_id}/assignments/seat-remaining", headers=ADMIN_HEADERS).status_code == 200
    assert _status(exam_id)["to_generate"] == 1

    _update_papers(exam_id)
    after = _current_papers(exam_id)
    assert set(after) == set(before) | {late}
    assert all(after[n] == before[n] for n in before)


def test_nothing_to_update_is_rejected_but_full_regeneration_works():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    before = _current_papers(exam_id)
    r = _update_papers(exam_id)
    assert r.status_code == 400 and "up to date" in r.json()["detail"]

    assert _update_papers(exam_id, only_changed=False).status_code == 202
    after = _current_papers(exam_id)
    assert all(after[n][0] != before[n][0] for n in before)


def test_new_template_makes_every_paper_out_of_date():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    r = client.post(
        f"/api/exams/{exam_id}/templates",
        files={"file": ("v2.pdf", _pdf_bytes() + b"\n% v2", "application/pdf")},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 201, r.text
    assert _status(exam_id)["outdated"] == 2 and _exam_status(exam_id) == "READY"
    _update_papers(exam_id)
    assert _status(exam_id)["up_to_date"] == 2


def _print(exam_id: str, **params):
    return client.get(f"/api/exams/{exam_id}/generated/print", params=params, headers=ADMIN_HEADERS)


def test_print_only_new_papers():
    exam_id, _ = _ready_exam_with_papers(student_count=3)
    assert _status(exam_id)["not_printed"] == 3
    assert len(pymupdf.open(stream=_print(exam_id).content)) == 1 + 3
    assert _status(exam_id)["not_printed"] == 0
    assert _print(exam_id, only_new=True).status_code == 400

    numbers = sorted(_current_papers(exam_id))
    empty = next(s for s in _seat_map(exam_id)["seats"] if not s["occupant"])
    _move(exam_id, numbers[0], empty["id"])
    # The moved student's old paper shows the wrong seat, so it's left out of every print file.
    assert len(pymupdf.open(stream=_print(exam_id).content)) == 1 + 2

    _update_papers(exam_id)
    r = _print(exam_id, only_new=True)
    assert r.status_code == 200 and "-new" in r.headers["content-disposition"]
    doc = pymupdf.open(stream=r.content)
    assert len(doc) == 1 + 1 and numbers[0] in doc[1].get_text()


def test_renaming_the_exam_makes_every_paper_out_of_date():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    # Moving the exam keeps the papers: the date and time aren't printed on them.
    r = client.patch(f"/api/exams/{exam_id}", json={"exam_date": "2026-12-11", "start_time": "14:00:00"},
                     headers=ADMIN_HEADERS)
    assert r.status_code == 200 and _status(exam_id)["outdated"] == 0

    assert client.patch(f"/api/exams/{exam_id}", json={"exam_name": "Final (rescheduled)"},
                        headers=ADMIN_HEADERS).status_code == 200
    assert _status(exam_id)["outdated"] == 2
    _update_papers(exam_id)
    assert _status(exam_id)["up_to_date"] == 2
    r = client.get(f"/api/exams/{exam_id}/generated/print", headers=ADMIN_HEADERS)
    assert "Final (rescheduled)" in " ".join(pymupdf.open(stream=r.content)[0].get_text().split())


def test_renaming_the_room_makes_its_papers_out_of_date():
    exam_id, room_id = _ready_exam_with_papers(student_count=2)
    assert client.patch(f"/api/rooms/{room_id}", json={"room_number": "B200"},
                        headers=ADMIN_HEADERS).status_code == 200
    assert _status(exam_id)["outdated"] == 2
    _update_papers(exam_id)
    assert _status(exam_id)["up_to_date"] == 2
    r = client.get(f"/api/exams/{exam_id}/generated/print", headers=ADMIN_HEADERS)
    assert "B200" in pymupdf.open(stream=r.content)[1].get_text()


def test_papers_for_seated_students_while_some_still_need_a_seat():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    late = f"8{uuid.uuid4().int % 10**8:08d}"
    client.post(
        f"/api/exams/{exam_id}/roster/import/confirm",
        files={"file": ("late.csv", f"student_number,first_name,last_name\n{late},Late,Student\n", "text/csv")},
        headers=ADMIN_HEADERS,
    )
    # The late student has no seat: generating still works for everyone else, with a warning.
    check = client.get(f"/api/exams/{exam_id}/generated/validate", headers=ADMIN_HEADERS).json()
    assert check["valid"] and "1 student has no seat yet" in check["warnings"][0]
    assert _update_papers(exam_id, only_changed=False).status_code == 202
    assert _status(exam_id)["up_to_date"] == 2 and late not in _current_papers(exam_id)

    assert client.post(f"/api/exams/{exam_id}/assignments/seat-remaining", headers=ADMIN_HEADERS).status_code == 200
    assert client.get(f"/api/exams/{exam_id}/generated/validate", headers=ADMIN_HEADERS).json()["warnings"] == []
    _update_papers(exam_id)
    assert late in _current_papers(exam_id)
