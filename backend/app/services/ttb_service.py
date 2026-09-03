"""
Tuition Time Table (TTB) API integration service.
Fetches courses from UofT's TTB system and syncs to ExamFlow database.
"""

import logging
import xml.etree.ElementTree as ET

import httpx

logger = logging.getLogger(__name__)

TTB_BASE_URL = "https://api.easi.utoronto.ca/ttb"

# Session codes: 20269=Fall 2026, 20271=Winter 2027, 20269-20271=Fall-Winter
# Divisions: ARTSC=Arts & Science, APSC=Engineering, etc.
# Campuses: St. George, University of Toronto at Mississauga, Scarborough


async def fetch_reference_data() -> dict:
    """Fetch available sessions, divisions, campuses from TTB."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{TTB_BASE_URL}/reference-data")
        resp.raise_for_status()
        return parse_reference_data(resp.text)


def parse_reference_data(xml_text: str) -> dict:
    """Parse reference data XML into structured dict."""
    root = ET.fromstring(xml_text)
    payload = root.find("payload")

    sessions = []
    for s in payload.find("currentSessions").findall("currentSessions"):
        sessions.append({
            "label": s.find("label").text or "",
            "value": s.find("value").text or "",
            "group": s.find("group").text or "",
        })

    divisions = []
    for d in payload.find("divisions").findall("divisions"):
        divisions.append({
            "label": d.find("label").text or "",
            "value": d.find("value").text or "",
        })

    campuses = []
    for c in payload.find("campuses").findall("campuses"):
        campuses.append({
            "label": c.find("label").text or "",
            "value": c.find("value").text or "",
        })

    return {"sessions": sessions, "divisions": divisions, "campuses": campuses}


async def fetch_courses(
    session_code: str = "20269",
    division_code: str = "ARTSC",
    subject_code: str = "CSC",
    course_level: str = "100/A",
    page: int = 1,
    limit: int = 50,
) -> dict:
    """Fetch courses from TTB API via getPageableCourses endpoint."""
    payload = {
        "session": session_code,
        "divisions": [division_code],
        "subject": subject_code,
        "courseLevel": course_level,
        "page": page,
        "limit": limit,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{TTB_BASE_URL}/getPageableCourses",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        return parse_courses_response(resp.text)


def parse_courses_response(xml_text: str) -> dict:
    """Parse courses XML response into structured data."""
    root = ET.fromstring(xml_text)
    payload = root.find("payload")

    courses = []
    for c in payload.find("courses").findall("courses"):
        meeting_sections = []
        for ms in c.find("meetingSections").findall("meetingSections"):
            meetings = []
            for m in ms.find("meetings").findall("meetings"):
                meetings.append({
                    "sessionCode": m.find("sessionCode").text or "",
                    "courseCode": m.find("courseCode").text or "",
                    "sectionCode": m.find("sectionCode").text or "",
                    "day": m.find("day").text or "",
                    "startTime": m.find("startTime").text or "",
                    "endTime": m.find("endTime").text or "",
                    "building": m.find("building").text or "",
                    "room": m.find("room").text or "",
                    "instructors": m.find("instructors").text or "",
                })
            meeting_sections.append({
                "code": ms.find("code").text or "",
                "day": ms.find("day").text or "",
                "startTime": ms.find("startTime").text or "",
                "endTime": ms.find("endTime").text or "",
                "building": ms.find("building").text or "",
                "room": ms.find("room").text or "",
                "instructors": ms.find("instructors").text or "",
                "meetings": meetings,
            })

        courses.append({
            "code": c.find("code").text or "",
            "section": c.find("section").text or "",
            "sessionCode": c.find("sessionCode").text or "",
            "name": c.find("name").text or "",
            "description": c.find("description").text or "",
            "division": c.find("division").text or "",
            "department": c.find("department").text or "",
            "prerequisites": c.find("prerequisites").text or "",
            "exclusions": c.find("exclusions").text or "",
            "level": c.find("level").text or "",
            "campus": c.find("campus").text or "",
            "term": c.find("term").text or "",
            "weight": c.find("weight").text or "",
            "deliveryMode": c.find("deliveryMode").text or "",
            "meetingSections": meeting_sections,
        })

    total = int(payload.find("total").text or "0")
    return {"courses": courses, "total": total}


async def fetch_all_cs_courses(
    session_code: str = "20269",
    division_code: str = "ARTSC",
    course_level: str = "100/A",
) -> list[dict]:
    """Fetch all CSC courses across all levels."""
    all_courses = []
    levels = ["100/A", "200/B", "300/C", "400/D", "5+"]

    for level in levels:
        page = 1
        while True:
            result = await fetch_courses(
                session_code=session_code,
                division_code=division_code,
                subject_code="CSC",
                course_level=level,
                page=page,
                limit=50,
            )
            all_courses.extend(result["courses"])
            if len(result["courses"]) < 50:
                break
            page += 1

    return all_courses


async def sync_cs_courses_to_db(db_session, semester: str = "20269") -> int:
    """Sync CS courses from TTB to database. Returns count of synced courses."""
    from app.models import Course, Meeting

    courses_data = await fetch_all_cs_courses(session_code=semester)
    count = 0

    for c in courses_data:
        course_code = c["code"]

        # Get or create course
        course = db_session.query(Course).filter_by(course_code=course_code).first()
        if not course:
            course = Course(
                course_code=course_code,
                course_name=c["name"],
                department=c.get("department", ""),
            )
            db_session.add(course)
            db_session.flush()

        # Add meeting sections
        for ms in c.get("meetingSections", []):
            meeting = db_session.query(Meeting).filter_by(
                course_id=course.id,
                section_code=ms["code"],
                semester=semester,
            ).first()

            if not meeting:
                meeting = Meeting(
                    course_id=course.id,
                    section_code=ms["code"],
                    semester=semester,
                    day=ms.get("day", ""),
                    start_time=ms.get("startTime", ""),
                    end_time=ms.get("endTime", ""),
                    building=ms.get("building", ""),
                    room=ms.get("room", ""),
                    instructors=ms.get("instructors", ""),
                    max_capacity=0,
                    current_enrolment=0,
                )
                db_session.add(meeting)

        count += 1

    db_session.commit()
    return count
