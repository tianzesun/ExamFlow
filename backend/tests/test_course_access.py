"""Instructors and TAs see only the courses they were added to; the exam office sees everything."""

import uuid

from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, _create_exam_with_students, client

STAFF_HEADERS = {"Authorization": "Bearer dev-staff-token"}

# Every kind of exam data an instructor could otherwise read.
EXAM_PATHS = [
    "", "/roster", "/roster/attendance", "/assignments/seat-map", "/assignments", "/assignments/rules",
    "/templates", "/generated", "/generated/status", "/readiness", "/summary", "/seating-list?format=csv",
]


def _exam_without_instructor() -> tuple[str, str]:
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=5, instructor_access=False)
    course_id = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["course_id"]
    return exam_id, course_id


def _listed_exam_ids(headers) -> set[str]:
    return {e["id"] for e in client.get("/api/exams", params={"page_size": 100}, headers=headers).json()["exams"]}


def test_instructor_sees_nothing_of_a_course_they_are_not_on():
    exam_id, course_id = _exam_without_instructor()
    for path in EXAM_PATHS:
        r = client.get(f"/api/exams/{exam_id}{path}", headers=INSTRUCTOR_HEADERS)
        assert r.status_code == 404, (path, r.status_code)
    assert client.get(f"/api/courses/{course_id}", headers=INSTRUCTOR_HEADERS).status_code == 404
    assert exam_id not in _listed_exam_ids(INSTRUCTOR_HEADERS)
    courses = client.get("/api/courses", params={"page_size": 100}, headers=INSTRUCTOR_HEADERS).json()["courses"]
    assert course_id not in {c["id"] for c in courses}
    summaries = client.post("/api/exams/summaries", json={"exam_ids": [exam_id]}, headers=INSTRUCTOR_HEADERS).json()
    assert summaries == {}


def test_adding_and_removing_an_instructor():
    exam_id, course_id = _exam_without_instructor()
    # The address is matched however it is typed.
    r = client.post(f"/api/courses/{course_id}/people", json={"email": " Instructor@Example.LOCAL "},
                    headers=STAFF_HEADERS)
    assert r.status_code == 201, r.text
    person = r.json()
    assert person["email"] == "instructor@example.local" and person["role"] == "INSTRUCTOR"

    for path in EXAM_PATHS:
        assert client.get(f"/api/exams/{exam_id}{path}", headers=INSTRUCTOR_HEADERS).status_code == 200, path
    assert exam_id in _listed_exam_ids(INSTRUCTOR_HEADERS)
    people = client.get(f"/api/courses/{course_id}/people", headers=INSTRUCTOR_HEADERS).json()["people"]
    assert [p["email"] for p in people] == ["instructor@example.local"]

    assert client.delete(f"/api/courses/{course_id}/people/{person['id']}", headers=ADMIN_HEADERS).status_code == 204
    assert client.get(f"/api/exams/{exam_id}", headers=INSTRUCTOR_HEADERS).status_code == 404


def test_only_the_exam_office_manages_access():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    course_id = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["course_id"]
    r = client.post(f"/api/courses/{course_id}/people", json={"email": "someone@example.invalid"},
                    headers=INSTRUCTOR_HEADERS)
    assert r.status_code == 403
    r = client.post(f"/api/courses/{course_id}/people", json={"email": "instructor@example.local"},
                    headers=ADMIN_HEADERS)
    assert r.status_code == 409  # already added by the helper
    r = client.post(f"/api/courses/{course_id}/people", json={"email": "not-an-address"}, headers=ADMIN_HEADERS)
    assert r.status_code == 422


def test_exam_office_sees_every_exam():
    exam_id, _ = _exam_without_instructor()
    assert client.get(f"/api/exams/{exam_id}/roster", headers=STAFF_HEADERS).status_code == 200
    assert exam_id in _listed_exam_ids(STAFF_HEADERS)


def test_qr_check_on_a_paper_still_needs_no_sign_in():
    r = client.get(f"/api/verify/{uuid.uuid4().hex}")
    assert r.status_code == 200 and r.json()["valid"] is False
