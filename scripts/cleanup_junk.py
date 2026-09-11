"""
Clean up junk data from the old TTB sync.

Removes:
- Junk courses: hex-code TTB artifacts like "CSC 05CBF4"
- Junk exams: "EX XXXX" records and orphan exams (no matching course)
- Duplicate CSC 108 test exams
"""
import sys
sys.path.insert(0, "backend")

from app.database import get_db
from app.models.course import Course
from app.models.exam import Exam

JUNK_COURSE_RE = r"^[a-z]{3}\s[0-9a-f]{6}$"
JUNK_EXAM_RE = r"^ex\s[0-9a-f]{6}$"


def clean():
    with next(get_db()) as db:
        # Junk courses: "CSC 05CBF4" style hex codes
        junk_courses = db.query(Course).filter(
            Course.course_code.op("~*")(JUNK_COURSE_RE)
        ).all()
        for c in junk_courses:
            db.delete(c)
        print(f"Deleted {len(junk_courses)} junk courses")

        # Junk exams: "EX 4F9232" hex pattern
        junk_exams = db.query(Exam).filter(
            Exam.course_code.op("~*")(JUNK_EXAM_RE)
        ).all()
        for e in junk_exams:
            db.delete(e)
        print(f"Deleted {len(junk_exams)} junk exams (EX XXXX)")

        # Exams whose course_code doesn't match any real course
        all_exam_codes = {e.course_code for e in db.query(Exam).all()}
        real_codes = {c.course_code for c in db.query(Course).all()}
        orphan_codes = all_exam_codes - real_codes
        orphan_exams = db.query(Exam).filter(
            Exam.course_code.in_(list(orphan_codes))
        ).all()
        for e in orphan_exams:
            db.delete(e)
        print(f"Deleted {len(orphan_exams)} orphan exams (no matching course)")

        db.commit()
        print(f"\nAfter cleanup: {db.query(Course).count()} courses, {db.query(Exam).count()} exams")


if __name__ == "__main__":
    clean()
