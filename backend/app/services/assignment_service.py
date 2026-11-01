import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.exam_assignment import ExamAssignment
from app.models.exam_room import ExamRoom
from app.models.exam_student import ExamStudent
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student
from app.services import room_service


@dataclass
class AssignmentSummary:
    registered_students: int
    assigned_students: int
    unassigned_students: int
    available_seats: int
    unused_seats: int
    rooms_used: int
    room_details: list[dict]


# ── Exam Rooms ──────────────────────────────────────────────

def add_exam_room(db: Session, exam_id: UUID, room_id: UUID, user_id: UUID | None = None) -> ExamRoom:
    existing = db.query(ExamRoom).filter(
        ExamRoom.exam_id == exam_id,
        ExamRoom.room_id == room_id,
    ).first()
    if existing:
        raise ValueError("Room already selected for this exam")

    room = db.query(Room).filter(Room.id == room_id, Room.is_active).first()
    if not room:
        raise ValueError("Room not found or inactive")

    exam_room = ExamRoom(exam_id=exam_id, room_id=room_id)
    db.add(exam_room)
    if user_id:
        db.add(AuditLog(
            user_id=user_id,
            action="EXAM_ROOM_ADDED",
            entity_type="exam",
            entity_id=exam_id,
            new_values={"room_id": str(room_id), "building": room.building, "room_number": room.room_number},
        ))
    db.commit()
    db.refresh(exam_room)
    return exam_room


def remove_exam_room(db: Session, exam_id: UUID, room_id: UUID, user_id: UUID | None = None) -> bool:
    exam_room = db.query(ExamRoom).filter(
        ExamRoom.exam_id == exam_id,
        ExamRoom.room_id == room_id,
    ).first()
    if not exam_room:
        return False

    has_assignments = db.query(ExamAssignment).join(
        Seat, ExamAssignment.seat_id == Seat.id
    ).filter(
        ExamAssignment.exam_id == exam_id,
        Seat.room_id == room_id,
    ).first()
    if has_assignments:
        raise ValueError("Cannot remove room with existing assignments")

    if user_id:
        db.add(AuditLog(
            user_id=user_id,
            action="EXAM_ROOM_REMOVED",
            entity_type="exam",
            entity_id=exam_id,
            old_values={"room_id": str(room_id)},
        ))
    db.delete(exam_room)
    db.commit()
    return True


def get_exam_rooms(db: Session, exam_id: UUID) -> list[Room]:
    return (
        db.query(Room)
        .join(ExamRoom, ExamRoom.room_id == Room.id)
        .filter(ExamRoom.exam_id == exam_id)
        .order_by(Room.building, Room.room_number)
        .all()
    )


# ── Seating rules ───────────────────────────────────────────

class SeatingRules(BaseModel):
    """How automatic seating picks seats. Stored on the exam so every run follows the same rules."""

    # Who sits first: by student number, by name, or shuffled so friends don't end up together.
    order: Literal["student_number", "name", "random"] = "student_number"
    # every_other_seat leaves a checkerboard so no one sits beside or directly behind another student;
    # every_other_seat_and_row uses one seat in four.
    spacing: Literal["none", "every_other_seat", "every_other_seat_and_row"] = "none"
    # Students with accommodations (extra time or notes) sit here, and nobody else does.
    accommodation_room_id: UUID | None = None
    # How many paper versions (A, B, ...) to alternate between, so neighbours write different papers.
    versions: int = Field(1, ge=1, le=4)


def get_rules(db: Session, exam_id: UUID) -> SeatingRules:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")
    return SeatingRules(**(exam.seating_rules or {}))


def save_rules(db: Session, exam_id: UUID, rules: SeatingRules, user_id: UUID, reshuffle: bool = False) -> SeatingRules:
    """Save the rules. They apply the next time seating is generated; existing seats don't move."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")
    if rules.accommodation_room_id and rules.accommodation_room_id not in {r.id for r in get_exam_rooms(db, exam_id)}:
        raise ValueError("The accommodation room must be one of this exam's rooms")

    old = SeatingRules(**(exam.seating_rules or {}))
    if rules.order == "random" and (reshuffle or old.order != "random" or not exam.assignment_seed):
        exam.assignment_seed = secrets.token_hex(8)
    exam.seating_rules = rules.model_dump(mode="json")
    db.add(AuditLog(
        user_id=user_id,
        action="SEATING_RULES_UPDATED",
        entity_type="exam",
        entity_id=exam_id,
        old_values=old.model_dump(mode="json"),
        new_values={**rules.model_dump(mode="json"), "reshuffled": rules.order == "random" and reshuffle},
    ))
    db.commit()
    return rules


def needs_accommodation(es: ExamStudent) -> bool:
    return (es.extra_time_minutes or 0) > 0 or bool((es.accommodation_notes or "").strip())


def _n(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


PAPER_VERSIONS = "ABCD"


def version_for_seat(seat: Seat, rules: SeatingRules) -> str:
    """The paper version for a seat, alternating so the nearest occupied seats differ.

    With every seat used, neighbours beside, in front and behind differ. With the
    checkerboard, the nearest students are diagonal, so versions alternate by row.
    """
    if rules.versions == 1 or seat.row_number is None or seat.column_number is None:
        return "A"
    row, col = seat.row_number, seat.column_number
    if rules.spacing == "every_other_seat":
        index = row
    elif rules.spacing == "every_other_seat_and_row":
        index = (row - 1) // 2 + (col - 1) // 2
    else:
        index = row + col
    return PAPER_VERSIONS[index % rules.versions]


def _seat_allowed(seat: Seat, spacing: str) -> bool:
    row, col = seat.row_number, seat.column_number
    if spacing == "none" or row is None or col is None:
        return True
    if spacing == "every_other_seat":
        return (row + col) % 2 == 0
    return row % 2 == 1 and col % 2 == 1


# ── Seats other exams hold at the same time ─────────────────

def exam_label(exam: Exam) -> str:
    return f"{exam.course_code} — {exam.exam_name}"


def _window(exam: Exam, extra_minutes: int = 0) -> tuple[datetime, datetime]:
    start = datetime.combine(exam.exam_date, exam.start_time)
    return start, start + timedelta(minutes=exam.duration_minutes + extra_minutes)


def seats_taken_elsewhere(db: Session, exam_id: UUID, room_ids: list[UUID] | None = None) -> dict[UUID, str]:
    """Seats another exam has a student in while this one runs, with that exam's name.

    Two exams can share a room (a gym, a large hall) but never a seat. Each seated student
    counts until their own extra time is over; this exam runs until its longest extra time ends.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return {}
    own_extra = db.query(func.max(ExamStudent.extra_time_minutes)).filter(ExamStudent.exam_id == exam_id).scalar()
    start, end = _window(exam, own_extra or 0)
    q = (
        db.query(ExamAssignment.seat_id, Exam, ExamStudent.extra_time_minutes)
        .join(Exam, Exam.id == ExamAssignment.exam_id)
        .join(ExamStudent, ExamStudent.id == ExamAssignment.exam_student_id)
        # Same day or the day before, for an evening exam that runs past midnight.
        .filter(
            Exam.id != exam_id,
            Exam.status != "ARCHIVED",
            Exam.exam_date.between(exam.exam_date - timedelta(days=1), exam.exam_date + timedelta(days=1)),
        )
    )
    if room_ids is not None:
        q = q.join(Seat, Seat.id == ExamAssignment.seat_id).filter(Seat.room_id.in_(room_ids))
    taken: dict[UUID, str] = {}
    for seat_id, other, extra in q.all():
        other_start, other_end = _window(other, extra or 0)
        if other_start < end and start < other_end:
            taken[seat_id] = exam_label(other)
    return taken


def _check_seat_free_elsewhere(db: Session, exam_id: UUID, seat: Seat) -> None:
    other = seats_taken_elsewhere(db, exam_id, [seat.room_id]).get(seat.id)
    if other:
        raise ValueError(f"Seat {seat.seat_code} is taken by {other} at the same time")


# ── Seating plan ────────────────────────────────────────────

def _get_sorted_students(db: Session, exam_id: UUID) -> list[tuple[ExamStudent, Student]]:
    return (
        db.query(ExamStudent, Student)
        .join(Student, ExamStudent.student_id == Student.id)
        .filter(ExamStudent.exam_id == exam_id)
        .order_by(Student.student_number)
        .all()
    )


def _order_students(students: list[tuple[ExamStudent, Student]], rules: SeatingRules, seed: str | None) -> list:
    if rules.order == "name":
        return sorted(students, key=lambda r: (r[1].full_name.casefold(), r[1].student_number))
    if rules.order == "random":
        shuffled = sorted(students, key=lambda r: r[1].student_number)
        random.Random(seed or "").shuffle(shuffled)
        return shuffled
    return sorted(students, key=lambda r: r[1].student_number)


def _free_seats(db: Session, exam_id: UUID) -> list[tuple[Seat, Room]]:
    """Usable seats nobody holds yet, in this exam or another at the same time, room by room, front row
    first. Rooms since deactivated are skipped."""
    rooms = [room for room in get_exam_rooms(db, exam_id) if room.is_active]
    if not rooms:
        return []
    position = {room.id: i for i, room in enumerate(rooms)}
    by_id = {room.id: room for room in rooms}
    assigned_seat_ids = db.query(ExamAssignment.seat_id).filter(ExamAssignment.exam_id == exam_id)
    seats = (
        db.query(Seat)
        .filter(Seat.room_id.in_(list(by_id)), Seat.is_usable, ~Seat.id.in_(assigned_seat_ids))
        .all()
    )
    elsewhere = seats_taken_elsewhere(db, exam_id, list(by_id))
    seats = [s for s in seats if s.id not in elsewhere]
    seats.sort(key=lambda s: (position[s.room_id], s.row_number or 0, s.column_number or 0, s.seat_code))
    return [(seat, by_id[seat.room_id]) for seat in seats]


def _plan(
    db: Session, exam_id: UUID, students: list[tuple[ExamStudent, Student]]
) -> list[tuple[ExamStudent, Student, Seat, Room]]:
    """Match students to free seats following the exam's seating rules.

    Raises ValueError explaining what's short when the rules leave too few seats.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    rules = SeatingRules(**(exam.seating_rules or {})) if exam else SeatingRules()
    students = _order_students(students, rules, exam.assignment_seed if exam else None)
    free = _free_seats(db, exam_id)
    seats = [(seat, room) for seat, room in free if _seat_allowed(seat, rules.spacing)]
    spacing_hint = " with the current spacing" if rules.spacing != "none" else ""

    accommodation_room = rules.accommodation_room_id
    if accommodation_room not in {r.id for r in get_exam_rooms(db, exam_id)}:
        accommodation_room = None  # the room was removed from the exam

    if not accommodation_room:
        if len(students) > len(seats):
            raise ValueError(
                f"Not enough seats: {_n(len(students), 'student')} need a seat and {_n(len(seats), 'seat')} free"
                f"{spacing_hint}. Add a room{' or reduce the spacing' if spacing_hint else ''}."
            )
        return [(es, st, seat, room) for (es, st), (seat, room) in zip(students, seats)]

    special = [r for r in students if needs_accommodation(r[0])]
    regular = [r for r in students if not needs_accommodation(r[0])]
    special_seats = [(seat, room) for seat, room in seats if room.id == accommodation_room]
    regular_seats = [(seat, room) for seat, room in seats if room.id != accommodation_room]
    if len(special) > len(special_seats):
        raise ValueError(
            f"The accommodation room has {_n(len(special_seats), 'free seat')}{spacing_hint} for "
            f"{_n(len(special), 'student')} with accommodations. Choose a larger room or reduce the spacing."
        )
    if len(regular) > len(regular_seats):
        raise ValueError(
            f"Not enough seats outside the accommodation room: {_n(len(regular), 'student')} need a seat and "
            f"{_n(len(regular_seats), 'seat')} free{spacing_hint}. Add a room"
            f"{' or reduce the spacing' if spacing_hint else ''}."
        )
    return (
        [(es, st, seat, room) for (es, st), (seat, room) in zip(special, special_seats)]
        + [(es, st, seat, room) for (es, st), (seat, room) in zip(regular, regular_seats)]
    )


def _assignments(db: Session, plan: list, exam_id: UUID, version: int) -> list[ExamAssignment]:
    rules = get_rules(db, exam_id)
    return [
        ExamAssignment(
            exam_id=exam_id,
            exam_student_id=es.id,
            seat_id=seat.id,
            assignment_method="AUTOMATIC",
            version=version,
            paper_version=version_for_seat(seat, rules),
        )
        for es, _student, seat, _room in plan
    ]


# ── Preview ─────────────────────────────────────────────────

def preview_assignment(db: Session, exam_id: UUID) -> dict:
    rules = get_rules(db, exam_id)
    students = _get_sorted_students(db, exam_id)
    free = _free_seats(db, exam_id)
    available = sum(1 for seat, _ in free if _seat_allowed(seat, rules.spacing))
    plan = _plan(db, exam_id, students)
    rooms = get_exam_rooms(db, exam_id)
    return {
        "students": len(students),
        "rooms": len(rooms),
        "available_seats": available,
        # Usable seats the spacing rule keeps empty.
        "spaced_out_seats": len(free) - available,
        "accommodation_students": sum(1 for es, _ in students if needs_accommodation(es)),
        "assigned": len(plan),
        "unused": available - len(plan),
        "rules": rules.model_dump(mode="json"),
        "items": [
            {
                "assignment_order": i,
                "student_number": st.student_number,
                "full_name": st.full_name,
                "building": room.building,
                "room_number": room.room_number,
                "seat_code": seat.seat_code,
                "paper_version": version_for_seat(seat, rules),
            }
            for i, (_es, st, seat, room) in enumerate(plan[:20], start=1)
        ],
        "has_more": len(plan) > 20,
    }


# ── Confirm (Generate) ─────────────────────────────────────

def confirm_assignment(db: Session, exam_id: UUID, user_id: UUID) -> dict:
    existing = db.query(ExamAssignment).filter(ExamAssignment.exam_id == exam_id).first()
    if existing:
        raise ValueError("Seating has already been generated. Use regenerate to replace.")

    students = _get_sorted_students(db, exam_id)
    plan = _plan(db, exam_id, students)
    version = 1
    db.add_all(_assignments(db, plan, exam_id, version))
    db.add(AuditLog(
        user_id=user_id,
        action="SEATING_ASSIGNMENT_CREATED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={
            "student_count": len(students),
            "assignment_count": len(plan),
            "version": version,
            "rules": get_rules(db, exam_id).model_dump(mode="json"),
        },
    ))
    db.commit()

    return {
        "assigned": len(plan),
        "version": version,
        "student_count": len(students),
    }


# ── Regenerate ──────────────────────────────────────────────

def regenerate_assignment(db: Session, exam_id: UUID, user_id: UUID) -> dict:
    existing_count = db.query(ExamAssignment).filter(ExamAssignment.exam_id == exam_id).count()
    if not existing_count:
        raise ValueError("No existing assignments to regenerate")

    # Read the version before the old rows are deleted, or it always resets to 1.
    max_version = db.query(func.max(ExamAssignment.version)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 0
    new_version = max_version + 1

    db.query(ExamAssignment).filter(ExamAssignment.exam_id == exam_id).delete()

    students = _get_sorted_students(db, exam_id)
    try:
        plan = _plan(db, exam_id, students)
    except ValueError:
        db.rollback()  # keep the current seating when the new rules don't fit
        raise
    db.add_all(_assignments(db, plan, exam_id, new_version))
    db.add(AuditLog(
        user_id=user_id,
        action="SEATING_ASSIGNMENT_REGENERATED",
        entity_type="exam",
        entity_id=exam_id,
        old_values={"previous_count": existing_count},
        new_values={
            "student_count": len(students),
            "assignment_count": len(plan),
            "version": new_version,
            "rules": get_rules(db, exam_id).model_dump(mode="json"),
        },
    ))
    db.commit()

    return {
        "assigned": len(plan),
        "version": new_version,
        "previous_count": existing_count,
        "student_count": len(students),
    }


# ── Seat Remaining ──────────────────────────────────────────

def seat_remaining_students(db: Session, exam_id: UUID, user_id: UUID) -> dict:
    """Seat students who have no seat yet in the free seats, keeping every existing seat."""
    seated = {
        row[0] for row in db.query(ExamAssignment.exam_student_id).filter(ExamAssignment.exam_id == exam_id)
    }
    students = [(es, st) for es, st in _get_sorted_students(db, exam_id) if es.id not in seated]
    if not students:
        raise ValueError("Every student already has a seat")
    plan = _plan(db, exam_id, students)

    version = db.query(func.max(ExamAssignment.version)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 1
    db.add_all(_assignments(db, plan, exam_id, version))
    db.add(AuditLog(
        user_id=user_id,
        action="SEATING_REMAINING_ASSIGNED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={"assignment_count": len(plan), "version": version},
    ))
    db.commit()
    return {"assigned": len(plan), "version": version}


# ── Summary ─────────────────────────────────────────────────

def get_summary(db: Session, exam_id: UUID) -> AssignmentSummary:
    registered = db.query(func.count(ExamStudent.id)).filter(ExamStudent.exam_id == exam_id).scalar() or 0
    assigned = db.query(func.count(ExamAssignment.id)).filter(ExamAssignment.exam_id == exam_id).scalar() or 0

    room_ids = [r.id for r in get_exam_rooms(db, exam_id)]
    total_usable_seats = 0
    if room_ids:
        total_usable_seats = db.query(func.count(Seat.id)).filter(
            Seat.room_id.in_(room_ids),
            Seat.is_usable,
        ).scalar() or 0

    rooms_used = 0
    room_details = []
    if room_ids:
        for room in get_exam_rooms(db, exam_id):
            total_seats = db.query(func.count(Seat.id)).filter(
                Seat.room_id == room.id, Seat.is_usable
            ).scalar() or 0
            used_seats = db.query(func.count(ExamAssignment.id)).join(
                Seat, ExamAssignment.seat_id == Seat.id
            ).filter(
                ExamAssignment.exam_id == exam_id,
                Seat.room_id == room.id,
            ).scalar() or 0
            if used_seats > 0:
                rooms_used += 1
            room_details.append({
                "room_id": str(room.id),
                "building": room.building,
                "room_number": room.room_number,
                "total_seats": total_seats,
                "used_seats": used_seats,
                "available_seats": total_seats - used_seats,
            })

    return AssignmentSummary(
        registered_students=registered,
        assigned_students=assigned,
        unassigned_students=registered - assigned,
        available_seats=total_usable_seats,
        unused_seats=total_usable_seats - assigned,
        rooms_used=rooms_used,
        room_details=room_details,
    )


# ── Search / List ───────────────────────────────────────────

def search_assignments(
    db: Session,
    exam_id: UUID,
    query: str | None = None,
    room_id: UUID | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict], int]:
    q = (
        db.query(ExamAssignment, Student, Seat, Room)
        .join(ExamStudent, ExamAssignment.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .join(Room, Seat.room_id == Room.id)
        .filter(ExamAssignment.exam_id == exam_id)
    )

    if query:
        pattern = f"%{query}%"
        q = q.filter(
            (Student.student_number.ilike(pattern)) |
            (Student.full_name.ilike(pattern)) |
            (Seat.seat_code.ilike(pattern))
        )

    if room_id:
        q = q.filter(Seat.room_id == room_id)

    total = q.count()
    results = (
        q.order_by(Student.student_number)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    first = (page - 1) * page_size + 1
    return [
        {
            "id": str(a.id),
            "assignment_order": first + i,
            "student_id": str(s.id),
            "student_number": s.student_number,
            "full_name": s.full_name,
            "seat_code": seat.seat_code,
            "seat_id": str(seat.id),
            "room_id": str(room.id),
            "building": room.building,
            "room_number": room.room_number,
            "method": a.assignment_method,
            "version": a.version,
            "paper_version": a.paper_version,
        }
        for i, (a, s, seat, room) in enumerate(results)
    ], total


# ── Single Operations (kept for manual assign) ──────────────

def assign_student(
    db: Session,
    exam_id: UUID,
    student_id: UUID,
    seat_id: UUID,
    user_id: UUID,
    method: str = "MANUAL",
) -> ExamAssignment:
    exam_student = db.query(ExamStudent).filter(
        ExamStudent.exam_id == exam_id,
        ExamStudent.student_id == student_id,
    ).first()
    if not exam_student:
        raise ValueError("Student not in exam roster")

    existing = db.query(ExamAssignment).filter(
        ExamAssignment.exam_id == exam_id,
        ExamAssignment.exam_student_id == exam_student.id,
    ).first()
    if existing:
        raise ValueError("Student already assigned to a seat")

    seat_taken = db.query(ExamAssignment).filter(
        ExamAssignment.exam_id == exam_id,
        ExamAssignment.seat_id == seat_id,
    ).first()
    if seat_taken:
        raise ValueError("Seat already assigned")

    seat = db.query(Seat).filter(Seat.id == seat_id, Seat.is_usable).first()
    if not seat:
        raise ValueError("Seat not found or not usable")
    if not db.query(ExamRoom).filter(ExamRoom.exam_id == exam_id, ExamRoom.room_id == seat.room_id).first():
        raise ValueError("Seat is not in a room selected for this exam")
    _check_seat_free_elsewhere(db, exam_id, seat)

    # Use current max version for this exam
    max_version = db.query(func.max(ExamAssignment.version)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 0

    assignment = ExamAssignment(
        exam_id=exam_id,
        exam_student_id=exam_student.id,
        seat_id=seat_id,
        assignment_method=method,
        version=max_version + 1,
        paper_version=version_for_seat(seat, get_rules(db, exam_id)),
    )
    db.add(assignment)
    db.flush()

    student = db.query(Student).filter(Student.id == student_id).first()
    db.add(AuditLog(
        user_id=user_id,
        action="SEAT_ASSIGNED",
        entity_type="exam_assignment",
        entity_id=assignment.id,
        new_values={"student_number": student.student_number if student else "", "seat_id": str(seat_id)},
    ))
    db.commit()
    db.refresh(assignment)
    return assignment


def get_assignments(db: Session, exam_id: UUID) -> list[dict]:
    results, _ = search_assignments(db, exam_id)
    return results


def remove_assignment(db: Session, exam_id: UUID, assignment_id: UUID, user_id: UUID) -> bool:
    assignment = db.query(ExamAssignment).filter(
        ExamAssignment.id == assignment_id,
        ExamAssignment.exam_id == exam_id,
    ).first()
    if not assignment:
        return False

    db.add(AuditLog(
        user_id=user_id,
        action="SEAT_UNASSIGNED",
        entity_type="exam_assignment",
        entity_id=assignment.id,
        old_values={"seat_id": str(assignment.seat_id)},
    ))
    db.delete(assignment)
    db.commit()
    return True


# ── Seat Map / Manual Seating ───────────────────────────────

def get_seat_map(db: Session, exam_id: UUID) -> list[dict]:
    rooms = get_exam_rooms(db, exam_id)
    if not rooms:
        return []

    rows = (
        db.query(Seat, ExamAssignment, Student)
        .outerjoin(
            ExamAssignment,
            (ExamAssignment.seat_id == Seat.id) & (ExamAssignment.exam_id == exam_id),
        )
        .outerjoin(ExamStudent, ExamAssignment.exam_student_id == ExamStudent.id)
        .outerjoin(Student, ExamStudent.student_id == Student.id)
        .filter(Seat.room_id.in_([r.id for r in rooms]))
        .order_by(Seat.row_number, Seat.column_number)
        .all()
    )

    elsewhere = seats_taken_elsewhere(db, exam_id, [r.id for r in rooms])
    seats_by_room: dict[UUID, list[dict]] = {r.id: [] for r in rooms}
    room_seats: dict[UUID, list[Seat]] = {r.id: [] for r in rooms}
    for seat, assignment, student in rows:
        room_seats[seat.room_id].append(seat)
        seats_by_room[seat.room_id].append({
            "id": str(seat.id),
            "seat_code": seat.seat_code,
            "row_number": seat.row_number,
            "column_number": seat.column_number,
            "is_usable": seat.is_usable,
            # Another exam at the same time has a student here.
            "taken_by": elsewhere.get(seat.id),
            "occupant": {
                "assignment_id": str(assignment.id),
                "student_id": str(student.id),
                "student_number": student.student_number,
                "full_name": student.full_name,
                "method": assignment.assignment_method,
                "paper_version": assignment.paper_version,
            } if assignment else None,
        })

    result = []
    for room in rooms:
        seats = seats_by_room[room.id]
        result.append({
            "id": str(room.id),
            "building": room.building,
            "room_number": room.room_number,
            "capacity": room.capacity,
            **room_service.room_layout(room, room_seats[room.id]),
            "usable_seats": sum(1 for s in seats if s["is_usable"]),
            "occupied_seats": sum(1 for s in seats if s["occupant"]),
            "seats": seats,
        })
    return result


def get_unassigned_students(db: Session, exam_id: UUID) -> list[dict]:
    assigned = db.query(ExamAssignment.exam_student_id).filter(ExamAssignment.exam_id == exam_id)
    rows = (
        db.query(Student)
        .join(ExamStudent, ExamStudent.student_id == Student.id)
        .filter(ExamStudent.exam_id == exam_id, ~ExamStudent.id.in_(assigned))
        .order_by(Student.student_number)
        .all()
    )
    return [
        {"student_id": str(s.id), "student_number": s.student_number, "full_name": s.full_name}
        for s in rows
    ]


def move_student(db: Session, exam_id: UUID, student_id: UUID, seat_id: UUID, user_id: UUID) -> dict:
    """Put a student in a seat. Empty seat: assign or move. Occupied seat: swap the two students."""
    exam_student = db.query(ExamStudent).filter(
        ExamStudent.exam_id == exam_id,
        ExamStudent.student_id == student_id,
    ).first()
    if not exam_student:
        raise ValueError("Student not in exam roster")

    seat = db.query(Seat).filter(Seat.id == seat_id, Seat.is_usable).first()
    if not seat:
        raise ValueError("Seat not found or not usable")
    if not db.query(ExamRoom).filter(ExamRoom.exam_id == exam_id, ExamRoom.room_id == seat.room_id).first():
        raise ValueError("Seat is not in a room selected for this exam")
    _check_seat_free_elsewhere(db, exam_id, seat)

    current = db.query(ExamAssignment).filter(
        ExamAssignment.exam_id == exam_id,
        ExamAssignment.exam_student_id == exam_student.id,
    ).first()
    occupant = db.query(ExamAssignment).filter(
        ExamAssignment.exam_id == exam_id,
        ExamAssignment.seat_id == seat_id,
    ).first()

    if current and occupant and current.id == occupant.id:
        return {"action": "unchanged"}
    if occupant and not current:
        raise ValueError("Seat is occupied. Choose an empty seat or unassign that student first.")

    rules = get_rules(db, exam_id)
    new_version = (db.query(func.max(ExamAssignment.version)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 0) + 1

    old_values: dict = {}
    new_values: dict = {"seat_id": str(seat_id)}
    if occupant:
        # Unique constraints are checked per row, so free the target seat before moving into it.
        other_exam_student_id = occupant.exam_student_id
        vacated_seat_id = current.seat_id
        db.delete(occupant)
        db.flush()
        current.seat_id = seat_id
        current.assignment_method = "MANUAL"
        current.version = new_version
        current.paper_version = version_for_seat(seat, rules)
        db.flush()
        db.add(ExamAssignment(
            exam_id=exam_id,
            exam_student_id=other_exam_student_id,
            seat_id=vacated_seat_id,
            assignment_method="MANUAL",
            version=new_version,
            paper_version=version_for_seat(db.get(Seat, vacated_seat_id), rules),
        ))
        action = "swapped"
        old_values["seat_id"] = str(vacated_seat_id)
        new_values["swapped_with_seat_id"] = str(vacated_seat_id)
    elif current:
        old_values["seat_id"] = str(current.seat_id)
        current.seat_id = seat_id
        current.assignment_method = "MANUAL"
        current.version = new_version
        current.paper_version = version_for_seat(seat, rules)
        action = "moved"
    else:
        current = ExamAssignment(
            exam_id=exam_id,
            exam_student_id=exam_student.id,
            seat_id=seat_id,
            assignment_method="MANUAL",
            version=new_version,
            paper_version=version_for_seat(seat, rules),
        )
        db.add(current)
        db.flush()
        action = "assigned"

    db.add(AuditLog(
        user_id=user_id,
        action={"assigned": "SEAT_ASSIGNED", "moved": "SEAT_MOVED", "swapped": "SEATS_SWAPPED"}[action],
        entity_type="exam_assignment",
        entity_id=current.id,
        old_values=old_values or None,
        new_values=new_values,
    ))
    db.commit()
    return {"action": action}
