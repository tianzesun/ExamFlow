import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ADMIN_HEADERS = {"Authorization": "Bearer dev-admin-token"}
INSTRUCTOR_HEADERS = {"Authorization": "Bearer dev-instructor-token"}


def _suffix():
    return uuid.uuid4().hex[:6].upper()


def _create_room(capacity: int) -> dict:
    response = client.post(
        "/api/rooms",
        json={"building": f"TEST-{_suffix()}", "room_number": "101", "capacity": capacity},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_exam_with_students(student_count: int, capacity: int) -> tuple[str, str, list[str]]:
    course = client.post(
        "/api/courses",
        json={"course_code": f"SEAT {_suffix()}", "course_name": "Seating Test"},
        headers=ADMIN_HEADERS,
    ).json()
    exam = client.post(
        "/api/exams",
        json={
            "course_id": course["id"],
            "exam_name": "Final",
            "term": "Fall",
            "academic_year": 2026,
            "exam_date": "2026-12-10",
            "start_time": "09:00:00",
            "duration_minutes": 120,
        },
        headers=ADMIN_HEADERS,
    ).json()
    exam_id = exam["id"]

    room = _create_room(capacity)
    assert client.post(
        f"/api/exams/{exam_id}/assignments/rooms", json={"room_id": room["id"]}, headers=ADMIN_HEADERS
    ).status_code == 201

    prefix = uuid.uuid4().int % 10**6
    numbers = [f"9{prefix:06d}{i:02d}" for i in range(student_count)]
    rows = [f"{n},Test,Student{i}" for i, n in enumerate(numbers)]
    csv_text = "student_number,first_name,last_name\n" + "\n".join(rows)
    response = client.post(
        f"/api/exams/{exam_id}/roster/import/confirm",
        files={"file": ("roster.csv", csv_text, "text/csv")},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200, response.text
    return exam_id, room["id"], numbers


def _seat_map(exam_id: str) -> dict:
    response = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    return response.json()["rooms"][0]


def _seat_of(room: dict, student_number: str) -> dict:
    return next(s for s in room["seats"] if s["occupant"] and s["occupant"]["student_number"] == student_number)


def test_large_room_gets_seat_per_capacity():
    room = _create_room(250)
    seats = client.get(f"/api/rooms/{room['id']}/seats", headers=ADMIN_HEADERS).json()
    assert len(seats) == 250
    assert len({s["seat_code"] for s in seats}) == 250
    assert seats[-1]["seat_code"] == "Y10"


def test_room_seats_follow_capacity_changes():
    room = _create_room(12)
    client.patch(f"/api/rooms/{room['id']}", json={"capacity": 30}, headers=ADMIN_HEADERS)
    assert len(client.get(f"/api/rooms/{room['id']}/seats", headers=ADMIN_HEADERS).json()) == 30
    client.patch(f"/api/rooms/{room['id']}", json={"capacity": 5}, headers=ADMIN_HEADERS)
    assert len(client.get(f"/api/rooms/{room['id']}/seats", headers=ADMIN_HEADERS).json()) == 5


def test_cannot_shrink_room_below_assigned_seats():
    exam_id, room_id, _ = _create_exam_with_students(student_count=4, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    response = client.patch(f"/api/rooms/{room_id}", json={"capacity": 2}, headers=ADMIN_HEADERS)
    assert response.status_code == 409


def test_seat_map_shows_occupants():
    exam_id, _, numbers = _create_exam_with_students(student_count=3, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)

    room = _seat_map(exam_id)
    assert room["usable_seats"] == 10
    assert room["occupied_seats"] == 3
    assert room["rows"] == 1 and room["columns"] == 10
    assert _seat_of(room, numbers[0])["seat_code"] == "A01"


def test_move_to_empty_seat_and_swap():
    exam_id, _, numbers = _create_exam_with_students(student_count=2, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    room = _seat_map(exam_id)
    first = _seat_of(room, numbers[0])
    second = _seat_of(room, numbers[1])
    empty = next(s for s in room["seats"] if not s["occupant"])

    response = client.post(
        f"/api/exams/{exam_id}/assignments/move",
        json={"student_id": first["occupant"]["student_id"], "seat_id": empty["id"]},
        headers=ADMIN_HEADERS,
    )
    assert response.json() == {"action": "moved"}
    room = _seat_map(exam_id)
    assert _seat_of(room, numbers[0])["id"] == empty["id"]
    assert _seat_of(room, numbers[0])["occupant"]["method"] == "MANUAL"

    response = client.post(
        f"/api/exams/{exam_id}/assignments/move",
        json={"student_id": first["occupant"]["student_id"], "seat_id": second["id"]},
        headers=ADMIN_HEADERS,
    )
    assert response.json() == {"action": "swapped"}
    room = _seat_map(exam_id)
    assert _seat_of(room, numbers[0])["id"] == second["id"]
    assert _seat_of(room, numbers[1])["id"] == empty["id"]
    assert room["occupied_seats"] == 2


def test_unassigned_student_can_be_seated():
    exam_id, _, numbers = _create_exam_with_students(student_count=2, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    room = _seat_map(exam_id)
    seat = _seat_of(room, numbers[1])
    client.delete(f"/api/exams/{exam_id}/assignments/{seat['occupant']['assignment_id']}", headers=ADMIN_HEADERS)

    unassigned = client.get(f"/api/exams/{exam_id}/assignments/unassigned", headers=ADMIN_HEADERS).json()
    assert [s["student_number"] for s in unassigned["students"]] == [numbers[1]]

    occupied = _seat_of(room, numbers[0])
    response = client.post(
        f"/api/exams/{exam_id}/assignments/move",
        json={"student_id": unassigned["students"][0]["student_id"], "seat_id": occupied["id"]},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 400

    response = client.post(
        f"/api/exams/{exam_id}/assignments/move",
        json={"student_id": unassigned["students"][0]["student_id"], "seat_id": seat["id"]},
        headers=ADMIN_HEADERS,
    )
    assert response.json() == {"action": "assigned"}
    assert client.get(f"/api/exams/{exam_id}/assignments/unassigned", headers=ADMIN_HEADERS).json()["students"] == []


def test_move_rejects_seat_outside_exam_rooms():
    exam_id, _, numbers = _create_exam_with_students(student_count=1, capacity=5)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    student_id = _seat_map(exam_id)["seats"][0]["occupant"]["student_id"]
    other_room = _create_room(5)
    other_seat = client.get(f"/api/rooms/{other_room['id']}/seats", headers=ADMIN_HEADERS).json()[0]

    response = client.post(
        f"/api/exams/{exam_id}/assignments/move",
        json={"student_id": student_id, "seat_id": other_seat["id"]},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 400


def test_move_requires_staff_role():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    seat = _seat_map(exam_id)["seats"][0]
    response = client.post(
        f"/api/exams/{exam_id}/assignments/move",
        json={"student_id": seat["occupant"]["student_id"], "seat_id": seat["id"]},
        headers=INSTRUCTOR_HEADERS,
    )
    assert response.status_code == 403


def test_cannot_unassign_through_another_exam():
    exam_a, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    exam_b, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    client.post(f"/api/exams/{exam_a}/assignments/confirm", headers=ADMIN_HEADERS)
    assignment_id = _seat_map(exam_a)["seats"][0]["occupant"]["assignment_id"]

    response = client.delete(f"/api/exams/{exam_b}/assignments/{assignment_id}", headers=ADMIN_HEADERS)
    assert response.status_code == 404
    assert _seat_map(exam_a)["occupied_seats"] == 1


def test_seat_remaining_keeps_existing_seats():
    exam_id, _, numbers = _create_exam_with_students(student_count=3, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    room = _seat_map(exam_id)
    kept = _seat_of(room, numbers[0])["id"]
    freed = _seat_of(room, numbers[2])
    client.delete(f"/api/exams/{exam_id}/assignments/{freed['occupant']['assignment_id']}", headers=ADMIN_HEADERS)

    response = client.post(f"/api/exams/{exam_id}/assignments/seat-remaining", headers=ADMIN_HEADERS)
    assert response.status_code == 200, response.text
    assert response.json()["assigned"] == 1
    room = _seat_map(exam_id)
    assert _seat_of(room, numbers[0])["id"] == kept
    assert client.get(f"/api/exams/{exam_id}/assignments/unassigned", headers=ADMIN_HEADERS).json()["students"] == []

    response = client.post(f"/api/exams/{exam_id}/assignments/seat-remaining", headers=ADMIN_HEADERS)
    assert response.status_code == 400


def test_seat_remaining_rejects_when_seats_run_out():
    exam_id, room_id, numbers = _create_exam_with_students(student_count=2, capacity=2)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    room = _seat_map(exam_id)
    last = _seat_of(room, numbers[1])
    client.delete(f"/api/exams/{exam_id}/assignments/{last['occupant']['assignment_id']}", headers=ADMIN_HEADERS)
    assert client.patch(f"/api/rooms/{room_id}", json={"capacity": 1}, headers=ADMIN_HEADERS).status_code == 200

    response = client.post(f"/api/exams/{exam_id}/assignments/seat-remaining", headers=ADMIN_HEADERS)
    assert response.status_code == 400
    assert "Not enough seats" in response.json()["detail"]


def test_regenerate_increments_version():
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=10)
    assert client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS).json()["version"] == 1
    response = client.post(f"/api/exams/{exam_id}/assignments/regenerate", headers=ADMIN_HEADERS)
    assert response.json()["version"] == 2


def test_assign_rejects_seat_outside_exam_rooms():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    student_id = client.get(f"/api/exams/{exam_id}/assignments/unassigned", headers=ADMIN_HEADERS).json()[
        "students"][0]["student_id"]
    other_seat = client.get(f"/api/rooms/{_create_room(5)['id']}/seats", headers=ADMIN_HEADERS).json()[0]

    response = client.post(
        f"/api/exams/{exam_id}/assignments",
        json={"student_id": student_id, "seat_id": other_seat["id"]},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 400


def test_deactivated_room_gets_no_students():
    exam_id, room_id, _ = _create_exam_with_students(student_count=2, capacity=5)
    assert client.patch(f"/api/rooms/{room_id}", json={"is_active": False}, headers=ADMIN_HEADERS).status_code == 200

    response = client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    assert response.status_code == 400
    summary = client.get(f"/api/exams/{exam_id}/assignments/summary", headers=ADMIN_HEADERS).json()
    assert summary["assigned_students"] == 0


def test_changes_to_a_missing_exam_are_not_found():
    missing = uuid.uuid4()
    room = _create_room(5)
    for path, body in [("rooms", {"room_id": room["id"]}), ("confirm", None), ("preview", None)]:
        response = client.post(f"/api/exams/{missing}/assignments/{path}", json=body, headers=ADMIN_HEADERS)
        assert response.status_code == 404, (path, response.text)
