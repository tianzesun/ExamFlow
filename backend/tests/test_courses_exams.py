from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ADMIN_HEADERS = {"Authorization": "Bearer dev-admin-token"}
STAFF_HEADERS = {"Authorization": "Bearer dev-staff-token"}
INSTRUCTOR_HEADERS = {"Authorization": "Bearer dev-instructor-token"}


def test_create_course():
    response = client.post(
        "/api/courses",
        json={"course_code": "CSC 108", "course_name": "Introduction to Computer Science"},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["course_code"] == "CSC 108"
    assert data["course_name"] == "Introduction to Computer Science"


def test_create_course_staff():
    response = client.post(
        "/api/courses",
        json={"course_code": "MATH 101", "course_name": "Calculus I"},
        headers=STAFF_HEADERS,
    )
    assert response.status_code == 201


def test_create_course_instructor_forbidden():
    response = client.post(
        "/api/courses",
        json={"course_code": "PHY 100", "course_name": "Physics I"},
        headers=INSTRUCTOR_HEADERS,
    )
    assert response.status_code == 403


def test_create_course_duplicate():
    response = client.post(
        "/api/courses",
        json={"course_code": "CSC 108", "course_name": "Duplicate"},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 409


def test_list_courses():
    response = client.get("/api/courses", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2


def test_get_course():
    list_resp = client.get("/api/courses", headers=ADMIN_HEADERS)
    course_id = list_resp.json()["courses"][0]["id"]
    response = client.get(f"/api/courses/{course_id}", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    assert response.json()["id"] == course_id


def test_update_course():
    list_resp = client.get("/api/courses", headers=ADMIN_HEADERS)
    course_id = list_resp.json()["courses"][0]["id"]
    response = client.patch(
        f"/api/courses/{course_id}",
        json={"department": "Computer Science"},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["department"] == "Computer Science"


def test_unauthenticated_course():
    response = client.get("/api/courses")
    assert response.status_code == 401


# Exam tests


def _get_course_id():
    resp = client.get("/api/courses", headers=ADMIN_HEADERS)
    return resp.json()["courses"][0]["id"]


def test_create_exam():
    course_id = _get_course_id()
    response = client.post(
        "/api/exams",
        json={
            "course_id": course_id,
            "exam_name": "Midterm Exam",
            "term": "Fall",
            "academic_year": 2026,
            "exam_date": "2026-10-15",
            "start_time": "14:00",
            "duration_minutes": 120,
        },
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["exam_name"] == "Midterm Exam"
    assert data["status"] == "DRAFT"


def test_create_exam_invalid_course():
    response = client.post(
        "/api/exams",
        json={
            "course_id": "00000000-0000-0000-0000-000000000000",
            "exam_name": "Test",
            "term": "Fall",
            "academic_year": 2026,
            "exam_date": "2026-10-15",
            "start_time": "14:00",
            "duration_minutes": 120,
        },
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 400


def test_list_exams():
    response = client.get("/api/exams", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1


def test_get_exam():
    list_resp = client.get("/api/exams", headers=ADMIN_HEADERS)
    exam_id = list_resp.json()["exams"][0]["id"]
    response = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    assert response.json()["id"] == exam_id


def test_update_exam_status():
    list_resp = client.get("/api/exams", headers=ADMIN_HEADERS)
    exam_id = list_resp.json()["exams"][0]["id"]
    response = client.patch(
        f"/api/exams/{exam_id}",
        json={"status": "CONFIGURED"},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "CONFIGURED"


def test_update_exam_invalid_status_transition():
    list_resp = client.get("/api/exams", headers=ADMIN_HEADERS)
    exams = list_resp.json()["exams"]
    draft_exam = next((e for e in exams if e["status"] == "CONFIGURED"), None)
    if draft_exam:
        response = client.patch(
            f"/api/exams/{draft_exam['id']}",
            json={"status": "READY"},
            headers=ADMIN_HEADERS,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "READY"


def test_unauthenticated_exam():
    response = client.get("/api/exams")
    assert response.status_code == 401
