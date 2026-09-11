"""Seed rooms and 3 exams tied to real UTSC CSC courses.

Models:
  Exam(id, course_id, course_code, course_name, exam_name, term, academic_year,
       exam_date, start_time, duration_minutes, status, assignment_seed,
       created_by, created_at, updated_at)
  Room(id, building, room_number, capacity, is_active, created_at, updated_at)
  Seat(id, room_id, seat_code, row_number, column_number, is_usable, status, ...)

User fields: id, external_id, display_name, email, role, is_active,
             created_at, updated_at

Course fields: id, course_code(unique), course_name, department, created_at, updated_at

Room service auto-creates seats when a room is created.
"""
from app.database import SessionLocal
from app.models.course import Course
from app.models.room import Room
from app.models.exam import Exam
from app.models.user import User
from app.services import room_service
from datetime import date, time
from uuid import UUID


session = SessionLocal()

# --- 1. Find owner (use existing Dev Admin) ---
admin: User | None = session.query(User).filter(User.role == "ADMIN").first()
if not admin:
    print("ERROR: no ADMIN user found — cannot create exams")
    session.close()
    raise SystemExit(1)
print(f"Exam owner: {admin.display_name} ({admin.email}) [{admin.id.hex[:8]}]")

# --- 2. Rooms ---
rooms_to_add = [
    ("PE C", "101", 120),
    ("PE C", "102", 80),
    ("Science", "S100", 60),
    ("Science", "S200", 40),
    ("HUM", "205", 100),
    ("HUM", "301", 50),
]

added = 0
for building, room_number, capacity in rooms_to_add:
    existing = session.query(Room).filter(
        Room.building == building, Room.room_number == room_number
    ).first()
    if existing:
        print(f"Room {building} {room_number} already exists (cap {existing.capacity})")
        continue
    try:
        room = room_service.create_room(session, building, room_number, capacity, admin.id)
        print(f"  Created {building} {room_number} (cap {room.capacity}, {len(room_service.get_room_seats(session, room.id))} seats)")
        added += 1
    except ValueError as e:
        print(f"  Skipped {building} {room_number}: {e}")

print(f"-> {added} new rooms; total rooms: {session.query(Room).count()}\n")

# --- 3. Find 3 real UTSC CSC courses ---
target_codes = ["CSCA08H3", "CSCB07H3", "CSCC43H3"]
courses = {}
for code in target_codes:
    c = session.query(Course).filter_by(course_code=code).first()
    if not c:
        print(f"WARNING: course {code} not found in database")
        continue
    courses[code] = c
    print(f"Found course: {c.course_code} — {c.course_name}")

if len(courses) < 2:
    print("ERROR: need at least 2 of the target courses")
    session.close()
    raise SystemExit(1)

# --- 4. Create exams ---
exams_to_create = [
    {
        "course_code": "CSCA08H3",
        "exam_name": "CSCA08H3 — Introduction to Computer Science I",
        "term": "Fall",
        "academic_year": 2026,
        "exam_date": date(2026, 12, 11),
        "start_time": time(14, 0),
        "duration_minutes": 120,
        "status": "READY",
    },
    {
        "course_code": "CSCB07H3",
        "exam_name": "CSCB07H3 — Software Design",
        "term": "Fall",
        "academic_year": 2026,
        "exam_date": date(2026, 12, 15),
        "start_time": time(9, 0),
        "duration_minutes": 180,
        "status": "DRAFT",
    },
    {
        "course_code": "CSCC43H3",
        "exam_name": "CSCC43H3 — Introduction to Databases",
        "term": "Fall",
        "academic_year": 2026,
        "exam_date": date(2026, 12, 18),
        "start_time": time(11, 0),
        "duration_minutes": 150,
        "status": "DRAFT",
    },
]

from app.services import exam_service

created = 0
for spec in exams_to_create:
    code = spec["course_code"]
    if code not in courses:
        print(f"  SKIP {code}: course not found")
        continue
    existing = session.query(Exam).filter_by(
        course_id=courses[code].id, exam_date=spec["exam_date"], start_time=spec["start_time"]
    ).first()
    if existing:
        print(f"  Exam for {code} on {spec['exam_date']} already exists")
        continue
    exam = exam_service.create_exam(session, type("D", (), {
        "course_id": courses[code].id,
        "exam_name": spec["exam_name"],
        "term": spec["term"],
        "academic_year": spec["academic_year"],
        "exam_date": spec["exam_date"],
        "start_time": spec["start_time"],
        "duration_minutes": spec["duration_minutes"],
    })(), admin.id)
    print(f"  Created {exam.exam_name} | {exam.exam_date} {exam.start_time} {exam.duration_minutes}min | {exam.status}")
    created += 1

print(f"-> {created} new exams; total exams: {session.query(Exam).count()}")

session.close()
print("\nDone.")
