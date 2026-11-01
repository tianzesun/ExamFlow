"""Moving a room's students to another room when a booking changes after seating."""

from tests.test_exam_day import _pdf_bytes
from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, _create_room, client
from tests.test_seating_rules import _rules


def _seated_exam() -> tuple[str, str, str]:
    """Four students, two in each of two 2-seat rooms, with papers made."""
    exam_id, first, _ = _create_exam_with_students(4, 2)
    second = _create_room(2)["id"]
    assert client.post(f"/api/exams/{exam_id}/assignments/rooms", json={"room_id": second},
                       headers=ADMIN_HEADERS).status_code == 201
    assert client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    assert client.post(f"/api/exams/{exam_id}/templates", files={"file": ("p.pdf", _pdf_bytes(), "application/pdf")},
                       headers=ADMIN_HEADERS).status_code == 201
    assert client.post(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).status_code == 200
    return exam_id, first, second


def _who_where(exam_id: str) -> dict[str, tuple[str, str]]:
    """student number → (room id, seat code)."""
    out = {}
    for room in client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()["rooms"]:
        for s in room["seats"]:
            if s["occupant"]:
                out[s["occupant"]["student_number"]] = (room["id"], s["seat_code"])
    return out


def _move(exam_id: str, from_room: str, to_room: str):
    return client.post(f"/api/exams/{exam_id}/assignments/rooms/{from_room}/move", json={"room_id": to_room},
                       headers=ADMIN_HEADERS)


def test_students_move_in_order_and_only_their_papers_need_reprinting():
    exam_id, first, second = _seated_exam()
    before = _who_where(exam_id)
    new = _create_room(10)["id"]
    r = _move(exam_id, first, new)
    assert r.status_code == 200, r.text
    assert r.json() == {"moved": 2, "room_added": True}

    after = _who_where(exam_id)
    moved = sorted((before[n][1], n) for n in before if before[n][0] == first)
    assert [after[n] for _, n in moved] == [(new, "A01"), (new, "A02")]  # same order, front first
    assert all(after[n] == before[n] for n in before if before[n][0] == second)  # nobody else moved

    rooms = {r["id"] for r in client.get(f"/api/exams/{exam_id}/assignments/rooms", headers=ADMIN_HEADERS).json()}
    assert rooms == {second, new}
    status = client.get(f"/api/exams/{exam_id}/generated/status", headers=ADMIN_HEADERS).json()
    assert status["outdated"] == 2 and status["up_to_date"] == 2

    log = client.get("/api/admin/activity", headers=ADMIN_HEADERS).json()["entries"]
    assert any(e["action"] == "EXAM_ROOM_REPLACED" for e in log)


def test_the_new_room_must_hold_everyone_under_the_rules():
    exam_id, first, _ = _seated_exam()
    _rules(exam_id, front_row_empty=True)
    small = _create_room(10)["id"]  # one row of ten: all front row
    r = _move(exam_id, first, small)
    assert r.status_code == 400 and "0 free seats" in r.json()["detail"]
    # Nothing changed: the room wasn't added and the first room is still there.
    rooms = {r["id"] for r in client.get(f"/api/exams/{exam_id}/assignments/rooms", headers=ADMIN_HEADERS).json()}
    assert small not in rooms and first in rooms


def test_moving_into_another_room_of_the_exam_uses_its_free_seats():
    exam_id, first, second = _seated_exam()
    client.patch(f"/api/rooms/{second}", json={"capacity": 4}, headers=ADMIN_HEADERS)
    r = _move(exam_id, first, second)
    assert r.status_code == 200 and r.json() == {"moved": 2, "room_added": False}
    assert {room for room, _ in _who_where(exam_id).values()} == {second}


def test_the_accommodation_room_follows_its_students():
    exam_id, first, second = _seated_exam()
    _rules(exam_id, accommodation_room_id=second)
    new = _create_room(10)["id"]
    assert _move(exam_id, second, new).status_code == 200
    rules = client.get(f"/api/exams/{exam_id}/assignments/rules", headers=ADMIN_HEADERS).json()
    assert rules["accommodation_room_id"] == new
    assert _move(exam_id, first, new).status_code == 400  # others can't join it
