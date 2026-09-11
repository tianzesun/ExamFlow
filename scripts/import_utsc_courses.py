#!/usr/bin/env python3
"""Import Computer Science courses from the UTSC Academic Calendar into the database.

Source: https://utsc.calendar.utoronto.ca/section/Computer-Science

The script:
  1. Fetches the Computer Science section page and extracts every CSC course code
     referenced in it.
  2. Fetches each course page and parses the official course title.
     Courses that are retired / not in the current calendar are skipped.
  3. Upserts the courses (idempotent - existing course codes are left untouched).

Usage (from the repository root):
    python3 scripts/import_utsc_courses.py            # fetch live from UTSC calendar
    python3 scripts/import_utsc_courses.py --dry-run  # list what would be imported
"""

import argparse
import re
import sys
import time
import urllib.error
import urllib.request

SECTION_URL = "https://utsc.calendar.utoronto.ca/section/Computer-Science"
COURSE_URL = "https://utsc.calendar.utoronto.ca/course/{code}"
DEPARTMENT = "Computer Science"
USER_AGENT = "Mozilla/5.0 (ExamFlow importer)"

sys.path.insert(0, "backend")

from app.config import get_settings
from app.database import SessionLocal
from app.models import Course


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="ignore")


def extract_course_codes(section_html: str) -> list[str]:
    """Collect every CSC course code referenced on the section page."""
    return sorted(set(re.findall(r"\b(CSC[A-Z]\d{2}H3)\b", section_html)))


def parse_course_page(code: str, html: str) -> str | None:
    """Return the official course title, or None if the course is not in the current calendar."""
    if "Sorry, this course is not in the current Calendar" in html:
        return None
    match = re.search(
        r"<h1 class=\"page-title\">\s*" + re.escape(code) + r"[\s:]*([\s\S]*?)</h1>",
        html,
    )
    if not match:
        return None
    name = re.sub(r"<[^>]+>", " ", match.group(1))
    return re.sub(r"\s+", " ", name).strip()


def fetch_courses() -> list[dict]:
    section_html = fetch(SECTION_URL)
    codes = extract_course_codes(section_html)
    print(f"Found {len(codes)} CSC course codes on the UTSC calendar section page")

    courses = []
    for i, code in enumerate(codes, 1):
        try:
            html = fetch(COURSE_URL.format(code=code))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            print(f"  [{i}/{len(codes)}] {code}: fetch failed ({e}) - skipped")
            continue
        name = parse_course_page(code, html)
        if name is None:
            print(f"  [{i}/{len(codes)}] {code}: not in current calendar - skipped")
            continue
        print(f"  [{i}/{len(codes)}] {code}: {name}")
        courses.append({"course_code": code, "course_name": name, "department": DEPARTMENT})
        time.sleep(0.3)  # be polite to the calendar server

    return courses


def upsert_courses(courses: list[dict], dry_run: bool = False) -> tuple[int, int]:
    created, existing = 0, 0
    db = SessionLocal()
    try:
        for data in courses:
            found = db.query(Course).filter(Course.course_code == data["course_code"]).first()
            if found:
                existing += 1
                continue
            if dry_run:
                created += 1
                continue
            db.add(Course(**data))
            created += 1
        if not dry_run:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return created, existing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="list courses without writing to the database")
    args = parser.parse_args()

    get_settings()  # fail fast on missing configuration
    courses = fetch_courses()
    if not courses:
        print("No courses found - nothing to import")
        return 1

    created, existing = upsert_courses(courses, dry_run=args.dry_run)
    verb = "Would create" if args.dry_run else "Created"
    print(f"\n{verb} {created} course(s); {existing} already in the database; total available: {len(courses)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
