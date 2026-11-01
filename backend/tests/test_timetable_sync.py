"""Timetable Builder sync: the term's courses and meeting times follow TTB on every run."""

import uuid
from unittest import mock

from app.database import SessionLocal
from app.models.course import Course
from app.models.meeting import Meeting
from app.services import ttb_service
from tests.test_seat_map import ADMIN_HEADERS, client

TERM = "20269"


def _course(code: str, name: str, sections: list[dict]) -> dict:
    return {"code": code, "name": name, "sections": sections}


def _section(number: str, *times: tuple[str, str, str], instructors=("A. Teacher",)) -> dict:
    return {
        "teachMethod": "LEC", "sectionNumber": number, "instructors": list(instructors),
        "maxEnrolment": 100, "currentEnrolment": 80,
        "meetingTimes": [
            {"day": d, "startTime": s, "endTime": e, "buildingCode": "IC", "room": "130"} for d, s, e in times
        ],
    }


def _meetings(db, code: str) -> list[tuple]:
    course = db.query(Course).filter_by(course_code=code).one()
    rows = db.query(Meeting).filter_by(course_id=course.id, semester=TERM).all()
    return sorted((m.section_code, m.day, m.start_time, m.instructors) for m in rows)


def test_sync_adds_then_follows_changes():
    code = f"TTB{uuid.uuid4().hex[:5].upper()}H3"
    with SessionLocal() as db:
        first = ttb_service.apply_timetable(db, TERM, [_course(code, "Old name", [
            _section("01", ("MO", "10:00", "11:00"), ("WE", "10:00", "11:00")),  # meets twice a week
            _section("02", ("TU", "13:00", "14:00")),
        ])])
        assert first["added"] == 1 and first["meetings"] == 3
        assert len(_meetings(db, code)) == 3

        # Next run: renamed, section 01 moved and taught by someone else, section 02 cancelled.
        second = ttb_service.apply_timetable(db, TERM, [_course(code, "New name", [
            _section("01", ("TH", "15:00", "16:00"), instructors=("B. Teacher",)),
        ])])
        assert (second["added"], second["renamed"]) == (0, 1)
        assert _meetings(db, code) == [("LEC01", "TH", "15:00", "B. Teacher")]
        assert db.query(Course).filter_by(course_code=code).one().course_name == "New name"


def test_sync_reports_ttb_trouble_but_not_as_its_own():
    with mock.patch.object(ttb_service, "fetch_all_cs_courses", side_effect=ttb_service.UpstreamError("down")):
        r = client.post("/api/ttb/sync", params={"semester": TERM}, headers=ADMIN_HEADERS)
    assert r.status_code == 502 and "Timetable Builder" in r.json()["detail"]
    assert client.post("/api/ttb/sync", params={"semester": "2026"}, headers=ADMIN_HEADERS).status_code == 422
