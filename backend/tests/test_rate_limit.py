"""Abuse guards on sign-in, the public QR check, uploads and paper generation."""

import uuid

from tests.test_seat_map import ADMIN_HEADERS, _create_exam_with_students, client

STAFF_HEADERS = {"Authorization": "Bearer dev-staff-token"}


def test_test_account_sign_in_is_limited_per_address():
    for _ in range(10):
        assert client.post("/api/auth/login", json={"token": "dev-admin-token"}).status_code == 200
    r = client.post("/api/auth/login", json={"token": "dev-admin-token"})
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) >= 1 and r.headers.get("x-request-id")
    assert "Wait a moment" in r.json()["detail"]


def test_qr_check_is_limited_per_address():
    for _ in range(60):
        assert client.get(f"/api/verify/{uuid.uuid4().hex}").status_code == 200
    assert client.get(f"/api/verify/{uuid.uuid4().hex}").status_code == 429


def test_generation_is_limited_per_person_not_for_everyone():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    # Nothing to generate yet, so each attempt is a quick 400 — but it still counts.
    for _ in range(20):
        assert client.post(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).status_code == 400
    assert client.post(f"/api/exams/{exam_id}/generated", headers=ADMIN_HEADERS).status_code == 429
    # Another person isn't held up by the first one's requests.
    assert client.post(f"/api/exams/{exam_id}/generated", headers=STAFF_HEADERS).status_code == 400


def test_limits_can_be_switched_off():
    from unittest import mock

    from app.config import get_settings

    with mock.patch.object(get_settings(), "RATE_LIMITS_ENABLED", False):
        for _ in range(15):
            assert client.post("/api/auth/login", json={"token": "dev-admin-token"}).status_code == 200
