import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ADMIN_HEADERS = {"Authorization": "Bearer dev-admin-token"}
STAFF_HEADERS = {"Authorization": "Bearer dev-staff-token"}
INSTRUCTOR_HEADERS = {"Authorization": "Bearer dev-instructor-token"}


def _unique_code(prefix="CSC"):
    return f"{prefix} {uuid.uuid4().hex[:6].upper()}"


def test_create_course():
    code = _unique_code("CSC")
    response = client.post(
        "/api/courses",
        json={"course_code": code, "course_name": "Introduction to Computer Science"},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["course_code"] == code


def test_create_course_staff():
    code = _unique_code("MATH")
    response = client.post(
        "/api/courses",
        json={"course_code": code, "course_name": "Calculus I"},
        headers=STAFF_HEADERS,
    )
    assert response.status_code == 201


def test_create_course_instructor_forbidden():
    response = client.post(
        "/api/courses",
        json={"course_code": _unique_code("PHY"), "course_name": "Physics I"},
        headers=INSTRUCTOR_HEADERS,
    )
    assert response.status_code == 403


def test_create_course_duplicate():
    code = _unique_code("DUP")
    client.post(
        "/api/courses",
        json={"course_code": code, "course_name": "Original"},
        headers=ADMIN_HEADERS,
    )
    response = client.post(
        "/api/courses",
        json={"course_code": code, "course_name": "Duplicate"},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 409


def test_list_courses():
    response = client.get("/api/courses", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1


def test_get_course():
    code = _unique_code("GET")
    create_resp = client.post(
        "/api/courses",
        json={"course_code": code, "course_name": "Get Test"},
        headers=ADMIN_HEADERS,
    )
    course_id = create_resp.json()["id"]
    response = client.get(f"/api/courses/{course_id}", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    assert response.json()["id"] == course_id


def test_update_course():
    code = _unique_code("UPD")
    create_resp = client.post(
        "/api/courses",
        json={"course_code": code, "course_name": "Update Test"},
        headers=ADMIN_HEADERS,
    )
    course_id = create_resp.json()["id"]
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


def _create_course():
    code = _unique_code("EX")
    resp = client.post(
        "/api/courses",
        json={"course_code": code, "course_name": "Exam Test Course"},
        headers=ADMIN_HEADERS,
    )
    return resp.json()["id"]


def test_create_exam():
    course_id = _create_course()
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
    course_id = _create_course()
    create_resp = client.post(
        "/api/exams",
        json={
            "course_id": course_id,
            "exam_name": "Get Test",
            "term": "Fall",
            "academic_year": 2026,
            "exam_date": "2026-10-15",
            "start_time": "14:00",
            "duration_minutes": 120,
        },
        headers=ADMIN_HEADERS,
    )
    exam_id = create_resp.json()["id"]
    response = client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    assert response.json()["id"] == exam_id


def test_update_exam_status():
    course_id = _create_course()
    create_resp = client.post(
        "/api/exams",
        json={
            "course_id": course_id,
            "exam_name": "Status Test",
            "term": "Fall",
            "academic_year": 2026,
            "exam_date": "2026-10-15",
            "start_time": "14:00",
            "duration_minutes": 120,
        },
        headers=ADMIN_HEADERS,
    )
    exam_id = create_resp.json()["id"]
    response = client.patch(
        f"/api/exams/{exam_id}",
        json={"status": "CONFIGURED"},
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "CONFIGURED"


def test_unauthenticated_exam():
    response = client.get("/api/exams")
    assert response.status_code == 401
