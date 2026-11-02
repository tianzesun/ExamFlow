"""Correcting a student's details, and class lists that show who dropped."""

import pymupdf

from tests.test_exam_day import _ready_exam_with_papers
from tests.test_paper_updates import _print, _status, _to_pull, _update_papers
from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, _create_exam_with_students, client
from tests.test_settings import _save


def _roster(exam_id: str) -> list[dict]:
    return client.get(f"/api/exams/{exam_id}/roster", headers=ADMIN_HEADERS).json()["students"]


def _edit(exam_id: str, student_id: str, headers=ADMIN_HEADERS, **details):
    return client.patch(f"/api/exams/{exam_id}/roster/{student_id}", json=details, headers=headers)


def test_correcting_a_name_dates_the_paper_and_reprints_it():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    first, second = sorted(_roster(exam_id), key=lambda s: s["student_number"])
    r = _edit(exam_id, first["student_id"], full_name="  Corrected   Name ", utorid="ABC123")
    assert r.status_code == 200 and (r.json()["full_name"], r.json()["utorid"]) == ("Corrected Name", "abc123")
    assert _status(exam_id)["outdated"] == 1  # only the corrected student's paper

    _update_papers(exam_id)
    doc = pymupdf.open(stream=_print(exam_id).content)
    assert "Corrected Name" in " ".join(page.get_text() for page in doc)
    assert _status(exam_id)["outdated"] == 0


def test_a_utorid_added_later_dates_papers_that_print_utorids():
    exam_id, _ = _ready_exam_with_papers(student_count=1)
    student = _roster(exam_id)[0]
    assert _edit(exam_id, student["student_id"], full_name=student["full_name"], utorid="late1").status_code == 200
    assert _status(exam_id)["outdated"] == 0  # the stamp doesn't print UTORids by default

    assert _save(paper_stamp={"show_name": True, "show_utorid": True, "every_page": True}).status_code == 200
    _update_papers(exam_id, only_changed=False)
    assert _edit(exam_id, student["student_id"], full_name=student["full_name"], utorid="late2").status_code == 200
    assert _status(exam_id)["outdated"] == 1


def test_student_details_checks():
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=5)
    a, b = _roster(exam_id)
    assert _edit(exam_id, a["student_id"], full_name="A", utorid="taken9").status_code == 200
    r = _edit(exam_id, b["student_id"], full_name="B", utorid="TAKEN9")
    assert r.status_code == 409 and "already has the UTORid" in r.json()["detail"]
    assert _edit(exam_id, b["student_id"], full_name="   ").status_code in (409, 422)
    assert _edit(exam_id, b["student_id"], headers=INSTRUCTOR_HEADERS, full_name="B").status_code == 403


def _csv(numbers: list[str]) -> str:
    return "student_number,name\n" + "\n".join(f"{n},Student {n}" for n in numbers)


def _import(exam_id: str, csv_text: str, step: str = "confirm", **params):
    return client.post(f"/api/exams/{exam_id}/roster/import/{step}", params=params,
                       files={"file": ("list.csv", csv_text, "text/csv")}, headers=ADMIN_HEADERS)


def test_class_list_shows_who_dropped_and_removes_them_when_asked():
    exam_id, _ = _ready_exam_with_papers(student_count=3)
    _print(exam_id)
    numbers = sorted(s["student_number"] for s in _roster(exam_id))
    late = f"{numbers[0][:-2]}99"
    still_enrolled = [numbers[0], numbers[1], late]

    preview = _import(exam_id, _csv(still_enrolled), step="preview").json()
    assert [d["student_number"] for d in preview["not_in_file"]] == [numbers[2]]
    assert preview["not_in_file"][0]["seat_code"]

    # Without the box ticked, nobody is removed.
    r = _import(exam_id, _csv(still_enrolled))
    assert r.json()["removed"] == 0 and len(_roster(exam_id)) == 4

    r = _import(exam_id, _csv(still_enrolled), remove_missing=True)
    assert r.json() == {"imported": 0, "skipped": 3, "removed": 1}
    assert sorted(s["student_number"] for s in _roster(exam_id)) == sorted(still_enrolled)
    # Their printed paper is listed to take out of the stack.
    assert [p["reason"] for p in _to_pull(exam_id)] == ["removed"]


def test_an_empty_file_removes_nobody():
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=5)
    assert _import(exam_id, "student_number,name\n", step="preview").json()["not_in_file"] == []
    _import(exam_id, "student_number,name\n", remove_missing=True)
    assert len(_roster(exam_id)) == 2
