"""Seating rules: order, spacing and the accommodation room."""

import uuid

from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, _create_exam_with_students, _create_room, client


def _rules(exam_id: str, reshuffle: bool = False, **rules):
    return client.put(
        f"/api/exams/{exam_id}/assignments/rules", json=rules, params={"reshuffle": reshuffle}, headers=ADMIN_HEADERS
    )


def _confirm(exam_id: str):
    r = client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text


def _seats(exam_id: str) -> dict[str, tuple[str, str]]:
    """student_number -> (room building, seat code)."""
    rooms = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()["rooms"]
    return {
        s["occupant"]["student_number"]: (room["building"], s["seat_code"])
        for room in rooms for s in room["seats"] if s["occupant"]
    }


def _preview_order(exam_id: str) -> list[str]:
    r = client.post(f"/api/exams/{exam_id}/assignments/preview", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    return [item["student_number"] for item in r.json()["items"]]


def test_rules_default_and_round_trip():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    r = client.get(f"/api/exams/{exam_id}/assignments/rules", headers=INSTRUCTOR_HEADERS)
    assert r.json() == {"order": "student_number", "spacing": "none", "accommodation_room_id": None, "versions": 1}
    assert _rules(exam_id, order="name", spacing="every_other_seat").status_code == 200
    assert client.get(f"/api/exams/{exam_id}/assignments/rules", headers=ADMIN_HEADERS).json()["order"] == "name"
    assert _rules(exam_id, order="alphabetical").status_code == 422
    r = client.put(f"/api/exams/{exam_id}/assignments/rules", json={"order": "name"}, headers=INSTRUCTOR_HEADERS)
    assert r.status_code == 403


def test_order_by_name():
    exam_id, _, numbers = _create_exam_with_students(student_count=12, capacity=20)
    _rules(exam_id, order="name")
    _confirm(exam_id)
    seats = _seats(exam_id)
    # Names are "Test Student0".."Test Student11", so Student10 sorts third.
    assert seats[numbers[0]][1] == "A01" and seats[numbers[1]][1] == "A02" and seats[numbers[10]][1] == "A03"


def test_random_order_matches_preview_and_reshuffles():
    exam_id, _, numbers = _create_exam_with_students(student_count=15, capacity=20)
    _rules(exam_id, order="random")
    order = _preview_order(exam_id)
    assert order == _preview_order(exam_id)  # the same draw every time
    assert order != sorted(order)

    _rules(exam_id, reshuffle=True, order="random")
    reshuffled = _preview_order(exam_id)
    assert reshuffled != order and sorted(reshuffled) == sorted(order)

    _confirm(exam_id)
    seats = _seats(exam_id)
    assert [seats[n][1] for n in reshuffled] == [f"A{i:02d}" for i in range(1, 11)] + [f"B{i:02d}" for i in range(1, 6)]


def test_every_other_seat_leaves_checkerboard():
    exam_id, _, numbers = _create_exam_with_students(student_count=10, capacity=30)
    _rules(exam_id, spacing="every_other_seat")
    preview = client.post(f"/api/exams/{exam_id}/assignments/preview", headers=ADMIN_HEADERS).json()
    assert preview["available_seats"] == 15 and preview["spaced_out_seats"] == 15
    _confirm(exam_id)
    codes = sorted(code for _, code in _seats(exam_id).values())
    assert codes == ["A01", "A03", "A05", "A07", "A09", "B02", "B04", "B06", "B08", "B10"]


def test_one_seat_in_four():
    exam_id, _, _ = _create_exam_with_students(student_count=6, capacity=30)
    _rules(exam_id, spacing="every_other_seat_and_row")
    _confirm(exam_id)
    codes = sorted(code for _, code in _seats(exam_id).values())
    assert codes == ["A01", "A03", "A05", "A07", "A09", "C01"]


def test_spacing_that_does_not_fit_explains_why():
    exam_id, _, _ = _create_exam_with_students(student_count=6, capacity=10)
    _rules(exam_id, spacing="every_other_seat")
    r = client.post(f"/api/exams/{exam_id}/assignments/preview", headers=ADMIN_HEADERS)
    assert r.status_code == 400
    assert "6 students need a seat and 5 seats free" in r.json()["detail"]
    assert "spacing" in r.json()["detail"]


def test_regenerate_keeps_seating_when_new_rules_do_not_fit():
    exam_id, _, _ = _create_exam_with_students(student_count=6, capacity=10)
    _confirm(exam_id)
    before = _seats(exam_id)
    _rules(exam_id, spacing="every_other_seat")
    assert client.post(f"/api/exams/{exam_id}/assignments/regenerate", headers=ADMIN_HEADERS).status_code == 400
    assert _seats(exam_id) == before


def test_seat_remaining_follows_spacing():
    exam_id, _, _ = _create_exam_with_students(student_count=3, capacity=10)
    _rules(exam_id, spacing="every_other_seat")
    _confirm(exam_id)
    late = f"8{uuid.uuid4().int % 10**8:08d}"
    client.post(
        f"/api/exams/{exam_id}/roster/import/confirm",
        files={"file": ("late.csv", f"student_number,first_name,last_name\n{late},Late,Student\n", "text/csv")},
        headers=ADMIN_HEADERS,
    )
    assert client.post(f"/api/exams/{exam_id}/assignments/seat-remaining", headers=ADMIN_HEADERS).status_code == 200
    assert _seats(exam_id)[late][1] == "A07"


def _flag(exam_id: str, student_number: str) -> None:
    roster = client.get(f"/api/exams/{exam_id}/roster", headers=ADMIN_HEADERS).json()
    entry = next(s for s in roster["students"] if s["student_number"] == student_number)
    r = client.put(
        f"/api/exams/{exam_id}/roster/{entry['student_id']}/accommodation",
        json={"extra_time_minutes": 30, "accommodation_notes": None},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200, r.text


def test_accommodation_room_seats_only_flagged_students():
    exam_id, main_room_id, numbers = _create_exam_with_students(student_count=4, capacity=10)
    quiet = _create_room(capacity=5)
    client.post(f"/api/exams/{exam_id}/assignments/rooms", json={"room_id": quiet["id"]}, headers=ADMIN_HEADERS)
    _flag(exam_id, numbers[2])

    assert _rules(exam_id, accommodation_room_id=str(uuid.uuid4())).status_code == 400
    assert _rules(exam_id, accommodation_room_id=quiet["id"]).status_code == 200
    preview = client.post(f"/api/exams/{exam_id}/assignments/preview", headers=ADMIN_HEADERS).json()
    assert preview["accommodation_students"] == 1
    _confirm(exam_id)

    seats = _seats(exam_id)
    assert seats[numbers[2]][0] == quiet["building"]
    assert all(seats[n][0] != quiet["building"] for n in numbers if n != numbers[2])


def test_accommodation_room_too_small_is_reported():
    exam_id, _, numbers = _create_exam_with_students(student_count=4, capacity=10)
    quiet = _create_room(capacity=1)
    client.post(f"/api/exams/{exam_id}/assignments/rooms", json={"room_id": quiet["id"]}, headers=ADMIN_HEADERS)
    _flag(exam_id, numbers[0])
    _flag(exam_id, numbers[1])
    _rules(exam_id, accommodation_room_id=quiet["id"])
    r = client.post(f"/api/exams/{exam_id}/assignments/preview", headers=ADMIN_HEADERS)
    assert r.status_code == 400 and "accommodation room" in r.json()["detail"]
