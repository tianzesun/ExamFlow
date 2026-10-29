import pytest

from app.services.exam_status_service import derive_status
from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, _seat_map, _seat_of, client


def _status(exam_id: str) -> str:
    return client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["status"]


def _patch_status(exam_id: str, status: str):
    return client.patch(f"/api/exams/{exam_id}", json={"status": status}, headers=ADMIN_HEADERS)


@pytest.mark.parametrize(
    "roster, rooms, assigned, generated, expected",
    [
        (0, 0, 0, 0, "DRAFT"),
        (5, 0, 0, 0, "DRAFT"),
        (0, 1, 0, 0, "DRAFT"),
        (5, 1, 0, 0, "CONFIGURED"),
        (5, 1, 4, 0, "CONFIGURED"),
        (5, 1, 5, 0, "READY"),
        (5, 1, 5, 4, "READY"),
        (5, 1, 5, 5, "GENERATED"),
    ],
)
def test_derive_status(roster, rooms, assigned, generated, expected):
    assert derive_status(roster, rooms, assigned, generated) == expected


def test_status_follows_roster_and_seating():
    exam_id, _, numbers = _create_exam_with_students(student_count=2, capacity=10)
    assert _status(exam_id) == "CONFIGURED"

    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    assert _status(exam_id) == "READY"

    seat = _seat_of(_seat_map(exam_id), numbers[1])
    client.delete(f"/api/exams/{exam_id}/assignments/{seat['occupant']['assignment_id']}", headers=ADMIN_HEADERS)
    assert _status(exam_id) == "CONFIGURED"


def test_derived_statuses_cannot_be_set_by_hand():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    response = _patch_status(exam_id, "READY")
    assert response.status_code == 400
    assert "automatically" in response.json()["detail"]
    assert _status(exam_id) == "CONFIGURED"


def test_complete_and_reopen():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    assert _patch_status(exam_id, "COMPLETED").status_code == 400  # not everyone seated yet

    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    assert _patch_status(exam_id, "COMPLETED").json()["status"] == "COMPLETED"

    # Completed is sticky: data changes don't move it.
    seat = _seat_of(_seat_map(exam_id), _seat_map(exam_id)["seats"][0]["occupant"]["student_number"])
    client.delete(f"/api/exams/{exam_id}/assignments/{seat['occupant']['assignment_id']}", headers=ADMIN_HEADERS)
    assert _status(exam_id) == "COMPLETED"

    # Reopening lands on whatever the data says, whichever derived status was asked for.
    assert _patch_status(exam_id, "DRAFT").json()["status"] == "CONFIGURED"


def test_archive_is_final():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    assert _patch_status(exam_id, "ARCHIVED").json()["status"] == "ARCHIVED"
    assert _patch_status(exam_id, "DRAFT").status_code == 400
