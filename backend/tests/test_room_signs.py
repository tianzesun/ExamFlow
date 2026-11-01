"""Door signs: which students write in which room."""

import uuid

import pymupdf

from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, _create_room, client
from tests.test_seating_rules import _flag, _rules

NAMES = ["Ana Li", "Ben Wu", "Kim Ho", "Kira Po", "Maya Ng"]


def _two_room_exam(order: str = "name") -> tuple[str, list[str], list[str]]:
    """Five students by name across two 3-seat rooms; returns the exam, its rooms in seating order, the numbers."""
    exam_id, first, _ = _create_exam_with_students(0, 3)
    second = _create_room(3)["id"]
    assert client.post(f"/api/exams/{exam_id}/assignments/rooms", json={"room_id": second},
                       headers=ADMIN_HEADERS).status_code == 201
    prefix = uuid.uuid4().int % 10**6
    # Numbers in the opposite order to names, so the two orders give different rooms.
    numbers = [f"8{prefix:06d}{9 - i:02d}" for i in range(len(NAMES))]
    csv_text = "student_number,first_name,last_name\n" + "\n".join(
        f"{n},{name.split()[0]},{name.split()[1]}" for n, name in zip(numbers, NAMES)
    )
    assert client.post(f"/api/exams/{exam_id}/roster/import/confirm", files={"file": ("r.csv", csv_text, "text/csv")},
                       headers=ADMIN_HEADERS).status_code == 200
    _rules(exam_id, order=order)
    assert client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    rooms = [r["room_id"] for r in _directions(exam_id)["rooms"]]
    return exam_id, rooms, numbers


def _directions(exam_id: str) -> dict:
    r = client.get(f"/api/exams/{exam_id}/room-directions", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    return r.json()


def _ranges(exam_id: str) -> list[tuple]:
    return [(r["from"], r["to"], r["students"]) for r in _directions(exam_id)["rooms"]]


def test_seating_by_name_gives_each_room_a_range_of_names():
    exam_id, _, _ = _two_room_exam()
    assert _directions(exam_id)["by"] == "name"
    # The shortest labels that tell Kim from Kira.
    assert _ranges(exam_id) == [("A", "Kim", 3), ("Kir", "M", 2)]


def test_seating_by_student_number_gives_ranges_of_numbers():
    exam_id, _, numbers = _two_room_exam(order="student_number")
    d = _directions(exam_id)
    assert d["by"] == "student_number"
    (a_from, a_to, a_n), (b_from, b_to, b_n) = _ranges(exam_id)
    assert (a_n, b_n) == (3, 2) and sorted(numbers)[0].startswith(a_from) and sorted(numbers)[-1].startswith(b_to)
    # The labels tell the last number in the first room from the first in the second.
    assert sorted(numbers)[2].startswith(a_to) and not sorted(numbers)[3].startswith(a_to)
    assert sorted(numbers)[3].startswith(b_from) and not sorted(numbers)[2].startswith(b_from)


def test_a_manual_move_that_breaks_the_blocks_falls_back_to_the_seating_list():
    exam_id, rooms, _ = _two_room_exam()
    seat_map = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()["rooms"]
    first = next(r for r in seat_map if any(s["occupant"] and s["occupant"]["full_name"] == "Ana Li"
                                            for s in r["seats"]))
    second = next(r for r in seat_map if r is not first)
    ana = next(s for s in first["seats"] if s["occupant"] and s["occupant"]["full_name"] == "Ana Li")
    free = next(s for s in second["seats"] if not s["occupant"])
    assert client.post(f"/api/exams/{exam_id}/assignments/move",
                       json={"student_id": ana["occupant"]["student_id"], "seat_id": free["id"]},
                       headers=ADMIN_HEADERS).status_code == 200
    d = _directions(exam_id)
    # Ana now sits with Kira and Maya; by number the blocks may still hold, but never by name.
    assert d["by"] != "name"


def test_the_accommodation_room_is_its_own_sign():
    exam_id, rooms, numbers = _two_room_exam()
    _flag(exam_id, numbers[0])  # Ana
    _flag(exam_id, numbers[4])  # Maya
    _rules(exam_id, order="name", accommodation_room_id=rooms[1])
    assert client.post(f"/api/exams/{exam_id}/assignments/regenerate", headers=ADMIN_HEADERS).status_code == 200
    d = _directions(exam_id)
    assert d["by"] == "name"
    main, special = d["rooms"]
    assert special["accommodation"] and special["students"] == 2
    assert (main["from"], main["to"], main["students"]) == ("B", "K", 3)


def test_signs_pdf_has_a_poster_then_a_sign_per_room():
    exam_id, _, _ = _two_room_exam()
    r = client.get(f"/api/exams/{exam_id}/room-signs", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    doc = pymupdf.open(stream=r.content)
    assert len(doc) == 3 and doc[0].rect.width > doc[0].rect.height
    assert "Who writes there" in doc[0].get_text()
    assert "Names A to Kim" in " ".join(doc[1].get_text().split())
    assert "Names Kir to M" in " ".join(doc[2].get_text().split())
    # No student's full name is posted on a door.
    assert not any(name in page.get_text() for page in doc for name in NAMES)


def test_no_signs_before_seating():
    exam_id, _, _ = _create_exam_with_students(2, 4)
    assert client.get(f"/api/exams/{exam_id}/room-signs", headers=ADMIN_HEADERS).status_code == 400


def test_number_ranges_read_as_numbers_and_one_room_needs_none():
    exam_id, _, numbers = _two_room_exam(order="student_number")
    (a_from, a_to, _), (b_from, b_to, _) = _ranges(exam_id)
    assert len(a_from) == len(a_to) and len(b_from) == len(b_to)

    one, _, _ = _create_exam_with_students(2, 4)
    assert client.post(f"/api/exams/{one}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    (room,) = _directions(one)["rooms"]
    assert room["everyone"]
    doc = pymupdf.open(stream=client.get(f"/api/exams/{one}/room-signs", headers=ADMIN_HEADERS).content)
    assert len(doc) == 1 and "All students" in doc[0].get_text()  # no poster for a single room
