"""Two exams at the same time may share a room, but never a seat."""

import threading
import uuid

from sqlalchemy.orm import Session

from app.database import engine
from app.services.assignment_service import _lock_rooms
from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, client
from tests.test_seating_rules import _flag


def _join(a: str, students: int, start: str) -> str:
    """Exam B on exam A's day, starting at start, using only A's room."""
    room_id = client.get(f"/api/exams/{a}/assignments/rooms", headers=ADMIN_HEADERS).json()[0]["id"]
    b, b_room, _ = _create_exam_with_students(students, 1)
    assert client.patch(f"/api/exams/{b}", json={"start_time": start}, headers=ADMIN_HEADERS).status_code == 200
    assert client.delete(f"/api/exams/{b}/assignments/rooms/{b_room}", headers=ADMIN_HEADERS).status_code in (200, 204)
    assert client.post(f"/api/exams/{b}/assignments/rooms", json={"room_id": room_id},
                       headers=ADMIN_HEADERS).status_code == 201
    return b


def _shared_room(second_students: int = 2, second_start: str = "09:00:00") -> tuple[str, str, str]:
    """Exam A (2 students) seated in a 4-seat room, 09:00–11:00 on 2026-12-10, and exam B sharing that room."""
    a, room_id, _ = _create_exam_with_students(2, 4)
    assert client.post(f"/api/exams/{a}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    return a, _join(a, second_students, second_start), room_id


def _seats(exam_id: str) -> dict[str, dict]:
    """seat_code → seat, for the exam's first room."""
    room = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()["rooms"][0]
    return {s["seat_code"]: s for s in room["seats"]}


def _occupied(exam_id: str) -> set[str]:
    return {code for code, s in _seats(exam_id).items() if s["occupant"]}


def test_second_exam_at_the_same_time_takes_the_other_seats():
    a, b, room_id = _shared_room()
    assert client.post(f"/api/exams/{b}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    assert _occupied(a).isdisjoint(_occupied(b)) and len(_occupied(b)) == 2

    seats = _seats(b)
    assert {code for code, s in seats.items() if s["taken_by"]} == _occupied(a)
    layout = client.get(f"/api/rooms/{room_id}/layout", params={"exam_id": b}, headers=ADMIN_HEADERS).json()
    assert {s["seat_code"] for s in layout["seats"] if s["taken_by"]} == _occupied(a)


def test_not_enough_seats_left_in_a_shared_room():
    _, b, _ = _shared_room(second_students=3)
    r = client.post(f"/api/exams/{b}/assignments/confirm", headers=ADMIN_HEADERS)
    assert r.status_code == 400 and "Not enough seats" in r.json()["detail"]


def test_exams_at_different_times_reuse_seats():
    a, b, _ = _shared_room(second_start="13:00:00")
    assert client.post(f"/api/exams/{b}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    assert _occupied(a) == _occupied(b)


def test_extra_time_keeps_a_seat_taken_past_the_exam():
    a, _, numbers = _create_exam_with_students(2, 4)
    _flag(a, numbers[0])  # 30 minutes extra: writes until 11:30, the other student until 11:00
    assert client.post(f"/api/exams/{a}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    b = _join(a, 1, "11:15:00")
    assert len([s for s in _seats(b).values() if s["taken_by"]]) == 1


def test_a_student_cant_be_moved_into_another_exams_seat():
    a, b, _ = _shared_room()
    assert client.post(f"/api/exams/{b}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    mine = next(s for s in _seats(b).values() if s["occupant"])
    theirs = next(s for s in _seats(b).values() if s["taken_by"])
    r = client.post(f"/api/exams/{b}/assignments/move",
                    json={"student_id": mine["occupant"]["student_id"], "seat_id": theirs["id"]}, headers=ADMIN_HEADERS)
    assert r.status_code == 400 and "at the same time" in r.json()["detail"]


def test_moving_an_exam_onto_anothers_time_is_flagged_before_printing():
    a, b, _ = _shared_room(second_start="13:00:00")
    assert client.post(f"/api/exams/{b}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    ready = client.get(f"/api/exams/{b}/readiness", headers=ADMIN_HEADERS).json()
    assert "seat_clashes" not in {c["name"] for c in ready["checks"]}

    assert client.patch(f"/api/exams/{b}", json={"start_time": "10:00:00"}, headers=ADMIN_HEADERS).status_code == 200
    check = next(c for c in client.get(f"/api/exams/{b}/readiness", headers=ADMIN_HEADERS).json()["checks"]
                 if c["name"] == "seat_clashes")
    assert check["status"] == "FAIL" and check["count"] == 2 and "SEAT" in check["message"]
    assert client.get(f"/api/exams/{b}/readiness", headers=ADMIN_HEADERS).json()["ready"] is False


def test_seating_waits_while_another_exam_is_seating_the_same_room():
    """Two exams seated at the same moment can't both take a seat that looked free to each."""
    # A room nobody has seated yet: tests share one transaction, so a room seated earlier stays held.
    b, room_id, _ = _create_exam_with_students(2, 4)
    other = engine.connect()  # another staff member's request, outside this test's transaction
    holder = Session(bind=other)
    _lock_rooms(holder, [uuid.UUID(room_id)])
    result = {}
    worker = threading.Thread(target=lambda: result.update(
        r=client.post(f"/api/exams/{b}/assignments/confirm", headers=ADMIN_HEADERS)))
    try:
        worker.start()
        worker.join(timeout=2)
        assert worker.is_alive(), "seating went ahead while the room was held"
    finally:
        holder.rollback()
        holder.close()
        other.close()
    worker.join(timeout=30)
    assert result["r"].status_code == 200
