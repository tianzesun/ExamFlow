"""Admin area: who has signed in, switching someone off, and the activity log."""

from datetime import datetime
from zoneinfo import ZoneInfo

from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, _create_exam_with_students, client


def _users() -> dict[str, dict]:
    return {u["email"]: u for u in client.get("/api/admin/users", headers=ADMIN_HEADERS).json()["users"]}


def test_people_lists_everyone_who_signed_in_with_their_courses():
    _create_exam_with_students(student_count=1, capacity=5)  # adds the test instructor to a course
    client.get("/api/auth/me", headers=INSTRUCTOR_HEADERS)
    users = _users()
    instructor = users["instructor@example.local"]
    assert instructor["role"] == "INSTRUCTOR" and instructor["is_active"] and instructor["courses"] >= 1
    assert instructor["source"] == "test account"


def test_switching_someone_off_blocks_them_at_once():
    client.get("/api/auth/me", headers=INSTRUCTOR_HEADERS)
    instructor = _users()["instructor@example.local"]
    r = client.patch(f"/api/admin/users/{instructor['id']}", json={"is_active": False}, headers=ADMIN_HEADERS)
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert client.get("/api/auth/me", headers=INSTRUCTOR_HEADERS).status_code == 403
    # Signing in again doesn't switch them back on.
    assert client.get("/api/auth/me", headers=INSTRUCTOR_HEADERS).status_code == 403

    client.patch(f"/api/admin/users/{instructor['id']}", json={"is_active": True}, headers=ADMIN_HEADERS)
    assert client.get("/api/auth/me", headers=INSTRUCTOR_HEADERS).status_code == 200


def test_admins_cannot_switch_themselves_off():
    me = client.get("/api/auth/me", headers=ADMIN_HEADERS).json()
    r = client.patch(f"/api/admin/users/{me['id']}", json={"is_active": False}, headers=ADMIN_HEADERS)
    assert r.status_code == 400


def test_activity_names_what_was_changed_and_filters():
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=5)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    course_code = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["course_code"]

    access = client.get("/api/admin/activity", params={"category": "access"}, headers=ADMIN_HEADERS).json()
    granted = next(e for e in access["entries"] if e["action"] == "COURSE_ACCESS_GRANTED")
    assert granted["entity_label"] == course_code and granted["user"]["name"] == "Dev Admin"
    assert all(e["category"] == "access" for e in access["entries"])

    seating = client.get("/api/admin/activity", params={"category": "seating"}, headers=ADMIN_HEADERS).json()
    assert any(e["action"] == "SEATING_ASSIGNMENT_CREATED" and e["entity_id"] == exam_id for e in seating["entries"])

    today_in_toronto = datetime.now(ZoneInfo("America/Toronto")).date().isoformat()
    today = client.get("/api/admin/activity", params={"day": today_in_toronto}, headers=ADMIN_HEADERS).json()
    assert today["total"] >= 3
    long_ago = client.get("/api/admin/activity", params={"day": "2000-01-01"}, headers=ADMIN_HEADERS).json()
    assert long_ago["total"] == 0
    assert client.get("/api/admin/activity", params={"category": "nope"}, headers=ADMIN_HEADERS).status_code == 400
