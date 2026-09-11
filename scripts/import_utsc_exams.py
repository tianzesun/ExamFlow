"""Import Summer 2026 final exams for UTSC Computer Science courses.

Source: https://www.utsc.utoronto.ca/registrar/examination-schedule
        (August Exam Schedule table)

Usage (from the repository root):
    python3 scripts/import_utsc_exams.py            # import live from UTSC registrar
    python3 scripts/import_utsc_exams.py --dry-run  # list what would be imported
"""

import argparse
import html
import re
import sys
import urllib.request
from datetime import datetime

SCHEDULE_URL = "https://www.utsc.utoronto.ca/registrar/examination-schedule"
TERM = "Summer"
USER_AGENT = "Mozilla/5.0 (ExamFlow importer)"

sys.path.insert(0, "backend")

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Course, Exam, User  # noqa: E402
from app.schemas.exam import ExamCreate  # noqa: E402
from app.services import exam_service  # noqa: E402


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="ignore")


def parse_schedule(page_html: str) -> list[dict]:
    """Parse the August Exam Schedule table, keeping CSC rows only."""
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", page_html, re.DOTALL)
    exams = []
    for row in rows:
        cells = [
            html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c))).strip()
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.DOTALL)
        ]
        if len(cells) < 5 or cells[0] == "Course and Section":
            continue
        # Course and Section looks like "CSCA48H3Y LEC01"
        m = re.match(r"\b(CSC[A-Z]\d{2}H3)Y?\b\s*(\S+)?", cells[0])
        if not m:
            continue  # non-CSC course, not in our DB
        exams.append(
            {
                "schedule_code": cells[0],
                "course_code": m.group(1),
                "section": m.group(2) or "",
                "date_str": cells[1],
                "start_str": cells[2],
                "end_str": cells[3],
                "room": cells[4],
                "changes": cells[5] if len(cells) > 5 else "",
            }
        )
    return exams


def to_exam_fields(entry: dict) -> dict | None:
    """Convert a raw schedule row to exam fields. None if unparsable."""
    try:
        exam_date = datetime.strptime(entry["date_str"], "%A, %B %d, %Y").date()
    except ValueError:
        return None
    try:
        start = datetime.strptime(entry["start_str"].strip(), "%H:%M").time()
        end = datetime.strptime(entry["end_str"].strip(), "%H:%M").time()
    except ValueError:
        return None
    duration = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)
    if duration <= 0:
        duration += 24 * 60
    if duration <= 0 or duration > 600:
        return None
    section = f" ({entry['section']})" if entry["section"] else ""
    return {
        "exam_name": f"Final Examination - Summer {exam_date.year}{section}",
        "term": TERM,
        "academic_year": exam_date.year,
        "exam_date": exam_date,
        "start_time": start,
        "duration_minutes": duration,
    }

def get_actor_id(db) -> object:
    user = (
        db.query(User).filter(User.role == "ADMIN", User.is_active.is_(True)).first()
        or db.query(User).filter(User.role == "STAFF", User.is_active.is_(True)).first()
        or db.query(User).filter(User.is_active.is_(True)).first()
    )
    if not user:
        raise RuntimeError("No active user in the database to attribute exams to")
    return user.id


def format_row(e: dict, fields: dict) -> str:
    room_note = "" if e["room"].lower().startswith("please refer") else f" | room: {e['room']}"
    change_note = f" | NOTE: {e['changes']}" if e["changes"] else ""
    return (
        f"{e['schedule_code']}: {fields['exam_name']} on {fields['exam_date']} "
        f"at {fields['start_time']} ({fields['duration_minutes']} min){room_note}{change_note}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="list without writing")
    args = parser.parse_args()

    get_settings()  # fail fast on missing configuration
    entries = parse_schedule(fetch(SCHEDULE_URL))
    print(f"Found {len(entries)} CSC rows on the UTSC examination-schedule page")

    db = SessionLocal()
    try:
        actor_id = get_actor_id(db)
        created, skipped, missing, bad = 0, 0, 0, 0
        for e in entries:
            fields = to_exam_fields(e)
            if fields is None:
                print(f"  {e['schedule_code']}: could not parse date/time - skipped")
                bad += 1
                continue
            course = db.query(Course).filter(Course.course_code == e["course_code"]).first()
            if not course:
                print(f"  {e['schedule_code']}: no course {e['course_code']} in DB - skipped")
                missing += 1
                continue
            exists = (
                db.query(Exam)
                .filter(
                    Exam.course_id == course.id,
                    Exam.term == fields["term"],
                    Exam.academic_year == fields["academic_year"],
                    Exam.exam_date == fields["exam_date"],
                )
                .first()
            )
            if exists:
                print(f"  {e['schedule_code']}: already exists ({exists.exam_name}) - skipped")
                skipped += 1
                continue
            print(f"  {format_row(e, fields)}")
            if not args.dry_run:
                exam_service.create_exam(db, ExamCreate(course_id=course.id, **fields), actor_id)
            created += 1
    finally:
        db.close()

    verb = "Would create" if args.dry_run else "Created"
    print(f"\n{verb} {created}; {skipped} existed; {missing} missing course; {bad} bad; rows: {len(entries)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

