"""Deleting exam data once its retention period has passed (Admin › Settings › Keeping data)."""

import os
from datetime import date
from unittest import mock

import pytest

from app.services import retention_service
from tests.test_exam_day import _papers, _ready_exam_with_papers
from tests.test_seat_map import ADMIN_HEADERS, client
from tests.test_settings import STAFF_HEADERS, _save

# The tests share the app's database, so their exams are dated long before any real one, and the clean-up
# runs as if it were 2003: a one-year period then reaches only exams from 2001.
OLD = "2001-01-10"
A_YEAR = 365


class _In2003(date):
    @classmethod
    def today(cls):
        return date(2003, 1, 1)


@pytest.fixture(autouse=True)
def in_2003():
    with mock.patch.object(retention_service, "date", _In2003):
        yield


def _old_exam(student_count: int = 2) -> str:
    exam_id, _ = _ready_exam_with_papers(student_count=student_count)
    assert client.patch(f"/api/exams/{exam_id}", json={"exam_date": OLD}, headers=ADMIN_HEADERS).status_code == 200
    return exam_id


def _run() -> tuple[dict, list[str]]:
    """Run the clean-up, recording the files it would delete instead of deleting them."""
    removed: list[str] = []
    with mock.patch.object(retention_service, "_remove_files", side_effect=removed.extend):
        r = client.post("/api/admin/retention/run", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    return r.json(), removed


def _exam(exam_id: str) -> dict:
    return client.get(f"/api/exams/{exam_id}", headers=ADMIN_HEADERS).json()


def _roster(exam_id: str) -> list[dict]:
    return client.get(f"/api/exams/{exam_id}/roster", headers=ADMIN_HEADERS).json()["students"]


def test_only_admins_see_or_run_the_clean_up():
    assert client.get("/api/admin/retention", headers=STAFF_HEADERS).status_code == 403
    assert client.post("/api/admin/retention/run", headers=STAFF_HEADERS).status_code == 403


def test_nothing_is_deleted_until_a_period_is_set():
    exam_id = _old_exam()
    assert client.get("/api/admin/retention", headers=ADMIN_HEADERS).json()["exams"] == 0
    result, removed = _run()
    assert result["exams"] == 0 and removed == []
    assert len(_papers(exam_id)) == 2 and _exam(exam_id)["status"] != "ARCHIVED"


def test_papers_are_deleted_and_the_exam_archived():
    old = _old_exam()
    recent, _ = _ready_exam_with_papers()
    old_files = [p["file_name"] for p in _papers(old)]
    assert _save(retention={"papers_days": A_YEAR, "exam_papers_days": None,
                            "rosters_days": None}).status_code == 200

    plan = client.get("/api/admin/retention", headers=ADMIN_HEADERS).json()
    assert plan["papers"] >= 2 and plan["roster_entries"] == 0
    result, removed = _run()
    assert result["papers"] >= 2
    assert _papers(old) == [] and len(_papers(recent)) == 2
    assert sum(f"/exams/{old}/generated/" in path for path in removed) == len(old_files)
    assert not any(f"/exams/{recent}/" in path for path in removed)
    # The roster and seating stay; the exam can no longer be changed.
    assert len(_roster(old)) == 2 and _exam(old)["status"] == "ARCHIVED"
    assert client.patch(f"/api/exams/{old}", json={"exam_name": "x"}, headers=ADMIN_HEADERS).status_code >= 400

    assert _run()[0]["papers"] == 0  # a second run finds nothing more


def test_rosters_and_unused_student_records_are_deleted():
    old = _old_exam(student_count=2)
    assert _save(retention={"papers_days": None, "exam_papers_days": A_YEAR,
                            "rosters_days": A_YEAR}).status_code == 200
    result, removed = _run()
    assert result["roster_entries"] >= 2 and result["exam_papers"] >= 1 and result["students"] >= 2
    assert _roster(old) == [] and _papers(old) == []
    assert any(f"/exams/{old}/templates/" in path for path in removed)
    assert all(os.path.basename(path) for path in removed)


def test_retention_periods_are_checked():
    assert _save(retention={"papers_days": 0, "exam_papers_days": None, "rosters_days": None}).status_code == 422
