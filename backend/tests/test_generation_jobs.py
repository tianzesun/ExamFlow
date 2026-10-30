"""Background paper generation jobs and their progress."""

import uuid
from datetime import timedelta
from unittest import mock

from app.database import SessionLocal
from app.models.generation_job import GenerationJob
from app.models.user import User
from app.services import generation_job_service
from app.utils import utcnow
from tests.test_exam_day import _papers, _pdf_bytes
from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, _create_exam_with_students, client

_run_job = generation_job_service.run_job


def _start(exam_id: str, headers=ADMIN_HEADERS):
    """Start a job, then run it once the request has finished.

    TestClient runs background tasks while the request's session is still open; with
    every test session sharing one connection, closing that session would roll the
    job's work back. In production each session has its own connection.
    """
    queued = []
    with mock.patch.object(generation_job_service, "run_job", side_effect=queued.append):
        response = client.post(f"/api/exams/{exam_id}/generated/jobs", headers=headers)
    for job_id in queued:
        _run_job(job_id)
    return response


def _seated_exam_with_template(student_count: int = 3) -> str:
    exam_id, _, _ = _create_exam_with_students(student_count=student_count, capacity=10)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    r = client.post(
        f"/api/exams/{exam_id}/templates",
        files={"file": ("paper.pdf", _pdf_bytes(), "application/pdf")},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 201, r.text
    return exam_id


def _latest(exam_id: str) -> dict | None:
    r = client.get(f"/api/exams/{exam_id}/generated/jobs/latest", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    return r.json()["job"]


def test_job_generates_papers_and_reports_progress():
    exam_id = _seated_exam_with_template(student_count=3)
    assert _latest(exam_id) is None

    r = _start(exam_id)
    assert r.status_code == 202, r.text
    assert r.json()["status"] == "QUEUED"
    job = _latest(exam_id)
    assert job["id"] == r.json()["id"]
    assert job["status"] == "SUCCEEDED"
    assert (job["done"], job["total"], job["generated"]) == (3, 3, 3)
    assert job["generation_version"] == 1
    assert len(_papers(exam_id)) == 3
    assert client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()["status"] == "GENERATED"


def test_job_rejected_when_exam_not_ready():
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=10)
    assert _start(exam_id).status_code == 400
    assert _latest(exam_id) is None


def test_unexpected_failure_shows_generic_error_with_reference():
    exam_id = _seated_exam_with_template(student_count=1)
    with mock.patch("app.services.pdf_service.generate_all_exams", side_effect=OSError("internal detail")):
        _start(exam_id)
    job = _latest(exam_id)
    assert job["status"] == "FAILED"
    assert "internal detail" not in job["error"]
    assert job["id"] in job["error"]
    assert _papers(exam_id) == []


def test_only_one_active_job_per_exam_and_stale_jobs_expire():
    exam_id = _seated_exam_with_template(student_count=1)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == "ADMIN").first()
        job = GenerationJob(exam_id=uuid.UUID(exam_id), status="RUNNING", created_by=admin.id)
        db.add(job)
        db.commit()
        job_id = job.id

        assert _start(exam_id).status_code == 409

        db.get(GenerationJob, job_id).updated_at = utcnow() - timedelta(minutes=30)
        db.commit()
    finally:
        db.close()

    latest = _latest(exam_id)
    assert latest["id"] == str(job_id) and latest["status"] == "FAILED"
    assert "interrupted" in latest["error"]
    assert _start(exam_id).status_code == 202
    assert _latest(exam_id)["status"] == "SUCCEEDED"


def test_instructor_cannot_start_job():
    exam_id = _seated_exam_with_template(student_count=1)
    assert _start(exam_id, headers=INSTRUCTOR_HEADERS).status_code == 403
