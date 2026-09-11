#!/usr/bin/env python3
"""Import UTSC final exam schedule entries as ExamFlow exams.

Source: https://www.utsc.utoronto.ca/registrar/examination-schedule
(Currently publishes the August 2026 exam schedule table.)

Usage (from the repository root):
    python3 scripts/import_utsc_exam_schedule.py            # import live schedule
    python3 scripts/import_utsc_exam_schedule.py --dry-run  # list what would be imported
"""

import argparse
import html
import re
import sys
import urllib.request
from datetime import datetime

SCHEDULE_URL = "https://www.utsc.utoronto.ca/registrar/examination-schedule"
TERM = "Summer"
ACADEMIC_YEAR = 2026
USER_AGENT = "Mozilla/5.0 (ExamFlow importer)"
DEV_ADMIN_EXTERNAL_ID = "dev-admin@example.local"

sys.path.insert(0, "backend")

from app.config import get_settings
from app.database import SessionLocal
from app.models import Course, Exam, User

ROW_RE = re.compile(
    r"(CSC[A-Z]\d{2}H3)Y?\s+(LEC\d+)\s+"
    r"((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+"
    r"[A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s+"
    r"(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})"
)


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="ignore")


def parse_schedule(page_html: str) -> list[dict]:
    """Extract CSC exam rows from the schedule page."""
    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page_html)))
    entries = []
    seen = set()
    for code, section, date_str, start_str, end_str in ROW_RE.findall(text):
        if code in seen:
            continue
        seen.add(code)
        exam_date = datetime.strptime(date_str.split(",", 1)[1].strip(), "%B %d, %Y").date()
        start = datetime.strptime(start_str, "%H:%M").time()
        end = datetime.strptime(end_str, "%H:%M").time()
        start_dt = datetime.combine(exam_date, start)
        end_dt = datetime.combine(exam_date, end)
        duration = int((end_dt - start_dt).total_seconds() // 60)
        entries.append(
            {
                "course_code": code,
                "section": section,
                "exam_date": exam_date,
                "start_time": start,
                "duration_minutes": duration,
            }
        )
    return sorted(entries, key=lambda e: (e["exam_date"], e["start_time"]))


def get_or_create_dev_admin(db) -> User:
    user = db.query(User).filter(User.external_id == DEV_ADMIN_EXTERNAL_ID).first()
    if user:
        return user
    user = User(
        external_id=DEV_ADMIN_EXTERNAL_ID,
        email="admin@example.local",
        display_name="Dev Admin",
        role="ADMIN",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def import_exams(entries: list[dict], dry_run: bool = False) -> tuple[int, int, list]:
    created, skipped = 0, 0
    missing = []
    db = SessionLocal()
    try:
        admin = get_or_create_dev_admin(db)
        for entry in entries:
            course = (
                db.query(Course)
                .filter(Course.course_code == entry["course_code"])
                .first()
            )
            if not course:
                missing.append(entry["course_code"])
                continue
            exists = (
                db.query(Exam)
                .filter(
                    Exam.course_id == course.id,
                    Exam.term == TERM,
                    Exam.academic_year == ACADEMIC_YEAR,
                )
                .first()
            )
            if exists:
                skipped += 1
                continue
            label = (
                f"{entry['course_code']} {entry['exam_date']} "
                f"{entry['start_time'].strftime('%H:%M')} "
                f"({entry['duration_minutes']}min, {entry['section']})"
            )
            if dry_run:
                print(f"  would create: {label}")
                created += 1
                continue
            db.add(
                Exam(
                    course_id=course.id,
                    course_code=course.course_code,
                    course_name=course.course_name,
                    exam_name=f"Final Exam ({entry['section']})",
                    term=TERM,
                    academic_year=ACADEMIC_YEAR,
                    exam_date=entry["exam_date"],
                    start_time=entry["start_time"],
                    duration_minutes=entry["duration_minutes"],
                    status="DRAFT",
                    created_by=admin.id,
                )
            )
            print(f"  created: {label}")
            created += 1
        if not dry_run:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return created, skipped, missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="list exams without writing to the database",
    )
    args = parser.parse_args()

    get_settings()  # fail fast on missing configuration
    entries = parse_schedule(fetch(SCHEDULE_URL))
    print(f"Found {len(entries)} CSC exam(s) on the UTSC exam schedule page")
    if not entries:
        print("No exams found - nothing to import")
        return 1

    created, skipped, missing = import_exams(entries, dry_run=args.dry_run)
    verb = "Would create" if args.dry_run else "Created"
    print(f"\n{verb} {created} exam(s); {skipped} already in the database")
    if missing:
        print(f"Courses not in database (skipped): {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
