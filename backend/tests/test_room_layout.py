"""Room layout: rows × seats per row, aisles, missing seats and seats not in use."""

import pymupdf

from tests.test_seat_map import (
    ADMIN_HEADERS,
    INSTRUCTOR_HEADERS,
    _create_exam_with_students,
    _create_room,
    _seat_map,
    _suffix,
    client,
)


def _layout(room_id: str) -> dict:
    r = client.get(f"/api/rooms/{room_id}/layout", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    return r.json()


def _seat_ids(room_id: str) -> dict[str, str]:
    seats = client.get(f"/api/rooms/{room_id}/seats", headers=ADMIN_HEADERS).json()
    return {s["seat_code"]: s["id"] for s in seats}


def _save(room_id: str, headers=ADMIN_HEADERS, **layout):
    body = {"aisles_after": [], "missing": [], "blocked": [], **layout}
    return client.put(f"/api/rooms/{room_id}/layout", json=body, headers=headers)


def test_create_room_from_rows_and_seats_per_row():
    r = client.post(
        "/api/rooms",
        json={"building": f"TEST-{_suffix()}", "room_number": "1", "rows": 3, "columns": 8, "aisles_after": [4, 99]},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 201, r.text
    assert r.json()["capacity"] == 24
    layout = _layout(r.json()["id"])
    assert (layout["rows"], layout["columns"], layout["aisles_after"]) == (3, 8, [4])
    assert [s["seat_code"] for s in layout["seats"]][-1] == "C08"


def test_rooms_without_a_saved_layout_keep_their_grid():
    room = _create_room(25)
    layout = _layout(room["id"])
    assert (layout["rows"], layout["columns"], layout["aisles_after"]) == (3, 10, [5])


def test_reshape_keeps_existing_seats_and_counts_capacity():
    room = _create_room(20)
    before = _seat_ids(room["id"])
    r = _save(room["id"], rows=4, columns=6, aisles_after=[3], missing=[[4, 1], [4, 6]], blocked=[[1, 1]])
    assert r.status_code == 200, r.text
    layout = r.json()
    codes = {s["seat_code"] for s in layout["seats"]}
    assert len(codes) == 22 and "A07" not in codes and "D01" not in codes and "D02" in codes
    assert next(s for s in layout["seats"] if s["seat_code"] == "A01")["is_usable"] is False

    after = _seat_ids(room["id"])
    assert after["A02"] == before["A02"], "seats that stay keep their id"
    assert client.get(f"/api/rooms/{room['id']}", headers=ADMIN_HEADERS).json()["capacity"] == 21


def test_seats_with_students_are_protected():
    exam_id, room_id, _ = _create_exam_with_students(student_count=3, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    layout = _layout(room_id)
    assert {s["seat_code"] for s in layout["seats"] if s["upcoming"]} == {"A01", "A02", "A03"}

    r = _save(room_id, rows=1, columns=2)
    assert r.status_code == 409 and "A03" in r.json()["detail"]
    r = _save(room_id, rows=1, columns=10, blocked=[[1, 2]])
    assert r.status_code == 409 and "A02" in r.json()["detail"] and "upcoming" in r.json()["detail"]
    assert _save(room_id, rows=2, columns=10, aisles_after=[5], blocked=[[1, 9]]).status_code == 200

    room = _seat_map(exam_id)
    assert room["aisles_after"] == [5] and room["rows"] == 2 and room["usable_seats"] == 19


def test_new_seats_are_used_for_seating():
    exam_id, room_id, _ = _create_exam_with_students(student_count=6, capacity=4)
    assert client.post(f"/api/exams/{exam_id}/assignments/preview", headers=ADMIN_HEADERS).status_code == 400
    assert _save(room_id, rows=2, columns=4, blocked=[[1, 1]]).status_code == 200
    assert client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS).status_code == 200
    codes = {s["seat_code"] for s in _seat_map(exam_id)["seats"] if s["occupant"]}
    assert "A01" not in codes and len(codes) == 6


def test_layout_validation_and_permissions():
    room = _create_room(5)
    assert _save(room["id"], rows=0, columns=5).status_code == 422
    assert _save(room["id"], rows=1, columns=2, blocked=[[1, 1], [1, 2]]).status_code == 409
    assert _save(room["id"], headers=INSTRUCTOR_HEADERS, rows=1, columns=5).status_code == 403
    assert client.get(f"/api/rooms/{room['id']}/layout", headers=INSTRUCTOR_HEADERS).status_code == 200


def test_rename_to_an_existing_room_is_refused():
    a, b = _create_room(5), _create_room(5)
    r = client.patch(f"/api/rooms/{b['id']}", json={"building": a["building"]}, headers=ADMIN_HEADERS)
    assert r.status_code == 409 and "already exists" in r.json()["detail"]


def test_printed_seating_map_leaves_room_for_aisles():
    exam_id, room_id, _ = _create_exam_with_students(student_count=4, capacity=12)
    assert _save(room_id, rows=2, columns=6, aisles_after=[3], missing=[[2, 6]]).status_code == 200
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    r = client.get(f"/api/exams/{exam_id}/seating-map/{room_id}", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    page = pymupdf.open(stream=r.content)[0]
    x = {w[4]: w[0] for w in page.get_text("words") if w[4] in ("A03", "A04", "A02")}
    assert x["A04"] - x["A03"] > x["A03"] - x["A02"], "the aisle widens the gap between seats 3 and 4"
    assert "B06" not in page.get_text()


def test_capacity_of_a_room_with_a_layout_is_set_by_the_layout():
    room = _create_room(20)
    assert _save(room["id"], rows=4, columns=6, missing=[[4, 1]], blocked=[[1, 1]]).status_code == 200
    r = client.patch(f"/api/rooms/{room['id']}", json={"capacity": 25}, headers=ADMIN_HEADERS)
    assert r.status_code == 409
    layout = _layout(room["id"])
    assert len(layout["seats"]) == 23
