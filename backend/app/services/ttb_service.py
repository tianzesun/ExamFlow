"""
Tuition Time Table (TTB) API integration service.
Fetches courses from UofT's TTB system and syncs to ExamFlow database.
"""

import asyncio
import logging
import xml.etree.ElementTree as ET

import httpx

logger = logging.getLogger(__name__)

TTB_BASE_URL = "https://api.easi.utoronto.ca/ttb"


async def fetch_reference_data() -> dict:
    """Fetch available sessions, divisions, campuses from TTB."""
    resp = await _request_with_retry("GET", f"{TTB_BASE_URL}/reference-data")
    return parse_reference_data(resp.text)


async def _request_with_retry(
    method: str,
    url: str,
    *,
    retries: int = 2,
    backoff_seconds: float = 1.5,
    **kwargs,
) -> httpx.Response:
    """POST/GET with retries for transient upstream failures.

    TTB occasionally hiccups (timeouts, 5xx, connection resets). Retry a
    couple of times with a short backoff before surfacing the error.
    """
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.request(method, url, **kwargs)
                resp.raise_for_status()
                return resp
        except (httpx.HTTPError, httpx.StreamError) as exc:
            last_exc = exc
            if attempt < retries:
                await asyncio.sleep(backoff_seconds * (attempt + 1))
    raise RuntimeError(f"TTB request failed after {retries + 1} attempts: {last_exc}") from last_exc


def parse_reference_data(xml_text: str) -> dict:
    """Parse reference data XML into structured dict."""
    root = ET.fromstring(xml_text)
    payload = root.find("payload")

    sessions = []
    for s in payload.find("currentSessions").findall("currentSessions"):
        sessions.append({
            "label": s.find("label").text or "",
            "value": s.find("value").text or "",
        })

    divisions = []
    for d in payload.find("divisions").findall("divisions"):
        divisions.append({
            "label": d.find("label").text or "",
            "value": d.find("value").text or "",
        })

    return {"sessions": sessions, "divisions": divisions}


async def fetch_courses(
    session_code: str = "20269",
    division_code: str = "ARTSC",
    subject_prefix: str = "CSC",
) -> list[dict]:
    """Fetch courses from TTB API via getCourses endpoint."""
    payload = {
        "sessions": [session_code],
        "divisions": [division_code],
    }

    resp = await _request_with_retry(
        "POST",
        f"{TTB_BASE_URL}/getCourses",
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    return parse_courses_response(resp.text, subject_prefix)


def parse_courses_response(xml_text: str, subject_prefix: str = "") -> list[dict]:
    """Parse courses XML response into structured data.

    Each course is a separate <payload> element under <TTBResponse>.
    """
    root = ET.fromstring(xml_text)

    courses = []
    # Each course is a direct <payload> child of <TTBResponse>
    for payload in root.findall("payload"):
        code_el = payload.find("code")
        if code_el is None:
            continue
        code = code_el.text or ""

        # Filter by subject prefix if specified
        if subject_prefix and not code.startswith(subject_prefix):
            continue

        sections = []
        sections_el = payload.find("sections")
        if sections_el is not None:
            for sec in sections_el.findall("sections"):
                meeting_times = []
                mt_el = sec.find("meetingTimes")
                if mt_el is not None:
                    for mt in mt_el.findall("meetingTimes"):
                        building = mt.find("building")
                        building_code = ""
                        room = ""
                        if building is not None:
                            bc = building.find("buildingCode")
                            building_code = bc.text if bc is not None else ""
                            rn = building.find("buildingRoomNumber")
                            rs = building.find("buildingRoomSuffix")
                            room_num = rn.text if rn is not None else ""
                            room_suffix = rs.text if rs is not None else ""
                            room = f"{room_num}{room_suffix}".strip()

                        start_el = mt.find("start")
                        end_el = mt.find("end")
                        session_el = mt.find("sessionCode")

                        # Extract day from start element
                        day = ""
                        if start_el is not None:
                            day_el = start_el.find("day")
                            day = day_el.text if day_el is not None else ""

                        # Extract time from millisofday
                        start_time = ""
                        if start_el is not None:
                            millis_el = start_el.find("millisofday")
                            if millis_el is not None and millis_el.text:
                                total_secs = int(millis_el.text) // 1000
                                hours = total_secs // 3600
                                mins = (total_secs % 3600) // 60
                                start_time = f"{hours:02d}:{mins:02d}"

                        end_time = ""
                        if end_el is not None:
                            millis_el = end_el.find("millisofday")
                            if millis_el is not None and millis_el.text:
                                total_secs = int(millis_el.text) // 1000
                                hours = total_secs // 3600
                                mins = (total_secs % 3600) // 60
                                end_time = f"{hours:02d}:{mins:02d}"

                        meeting_times.append({
                            "sessionCode": session_el.text if session_el is not None else "",
                            "day": day,
                            "startTime": start_time,
                            "endTime": end_time,
                            "buildingCode": building_code,
                            "room": room,
                        })

                instructors = []
                inst_el = sec.find("instructors")
                if inst_el is not None:
                    for inst in inst_el.findall("instructors"):
                        fn = inst.find("firstName")
                        ln = inst.find("lastName")
                        first = fn.text if fn is not None else ""
                        last = ln.text if ln is not None else ""
                        instructors.append(f"{first} {last}".strip())

                curr_el = sec.find("currentEnrolment")
                max_el = sec.find("maxEnrolment")
                name_el = sec.find("name")
                type_el = sec.find("type")
                teach_el = sec.find("teachMethod")
                secnum_el = sec.find("sectionNumber")

                sections.append({
                    "name": name_el.text if name_el is not None else "",
                    "type": type_el.text if type_el is not None else "",
                    "teachMethod": teach_el.text if teach_el is not None else "",
                    "sectionNumber": secnum_el.text if secnum_el is not None else "",
                    "currentEnrolment": int(curr_el.text) if curr_el is not None and curr_el.text else 0,
                    "maxEnrolment": int(max_el.text) if max_el is not None and max_el.text else 0,
                    "instructors": instructors,
                    "meetingTimes": meeting_times,
                })

        cm_info = payload.find("cmCourseInfo")
        description = ""
        prerequisites = ""
        if cm_info is not None:
            desc_el = cm_info.find("description")
            prereq_el = cm_info.find("prerequisitesText")
            description = desc_el.text if desc_el is not None else ""
            prerequisites = prereq_el.text if prereq_el is not None else ""

        name_el = payload.find("name")
        section_el = payload.find("sectionCode")
        campus_el = payload.find("campus")

        courses.append({
            "code": code,
            "name": name_el.text if name_el is not None else "",
            "sectionCode": section_el.text if section_el is not None else "",
            "campus": campus_el.text if campus_el is not None else "",
            "description": description,
            "prerequisites": prerequisites,
            "sections": sections,
        })

    return courses


async def fetch_all_cs_courses(
    session_code: str = "20269",
    division_code: str = "ARTSC",
) -> list[dict]:
    """Fetch all CSC courses."""
    return await fetch_courses(
        session_code=session_code,
        division_code=division_code,
        subject_prefix="CSC",
    )


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
                department="Computer Science",
            )
            db_session.add(course)
            db_session.flush()

        # Add sections with meeting times
        for sec in c.get("sections", []):
            for mt in sec.get("meetingTimes", []):
                section_code = f"{sec['teachMethod']}{sec['sectionNumber']}"
                meeting = db_session.query(Meeting).filter_by(
                    course_id=course.id,
                    section_code=section_code,
                    semester=semester,
                ).first()

                if not meeting:
                    meeting = Meeting(
                        course_id=course.id,
                        section_code=section_code,
                        semester=semester,
                        day=mt.get("day", ""),
                        start_time=mt.get("startTime", ""),
                        end_time=mt.get("endTime", ""),
                        building=mt.get("buildingCode", ""),
                        room=mt.get("room", ""),
                        instructors=", ".join(sec.get("instructors", [])),
                        max_capacity=sec.get("maxEnrolment", 0),
                        current_enrolment=sec.get("currentEnrolment", 0),
                    )
                    db_session.add(meeting)

        count += 1

    db_session.commit()
    return count
