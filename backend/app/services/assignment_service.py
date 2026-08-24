from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam_assignment import ExamAssignment
from app.models.exam_room import ExamRoom
from app.models.exam_student import ExamStudent
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student


@dataclass
class AssignmentPreviewItem:
    assignment_order: int
    student_id: str
    student_number: str
    full_name: str
    room_id: str
    building: str
    room_number: str
    seat_id: str
    seat_code: str


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

def add_exam_room(db: Session, exam_id: UUID, room_id: UUID) -> ExamRoom:
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
    db.commit()
    db.refresh(exam_room)
    return exam_room


def remove_exam_room(db: Session, exam_id: UUID, room_id: UUID) -> bool:
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


# ── Deterministic Algorithm ─────────────────────────────────

def _get_sorted_students(db: Session, exam_id: UUID) -> list[tuple[ExamStudent, Student]]:
    return (
        db.query(ExamStudent, Student)
        .join(Student, ExamStudent.student_id == Student.id)
        .filter(ExamStudent.exam_id == exam_id)
        .order_by(Student.student_number)
        .all()
    )


def _get_sorted_seats(db: Session, exam_id: UUID) -> list[Seat]:
    room_ids = [r.id for r in get_exam_rooms(db, exam_id)]
    if not room_ids:
        return []
    assigned_seat_ids = db.query(ExamAssignment.seat_id).filter(ExamAssignment.exam_id == exam_id)
    return (
        db.query(Seat)
        .filter(
            Seat.room_id.in_(room_ids),
            Seat.is_usable,
            ~Seat.id.in_(assigned_seat_ids),
        )
        .order_by(Seat.room_id, Seat.row_number, Seat.column_number)
        .all()
    )


def _build_preview(db: Session, exam_id: UUID) -> tuple[list[AssignmentPreviewItem], int, int]:
    students = _get_sorted_students(db, exam_id)
    seats = _get_sorted_seats(db, exam_id)

    available_count = len(seats)
    student_count = len(students)

    if student_count > available_count:
        raise ValueError(
            f"Insufficient seating capacity: {student_count} students, "
            f"{available_count} available seats"
        )

    room_cache: dict[UUID, Room] = {}
    previews = []
    for i, ((es, student), seat) in enumerate(zip(students, seats), start=1):
        if seat.room_id not in room_cache:
            room_cache[seat.room_id] = db.query(Room).filter(Room.id == seat.room_id).first()
        room = room_cache[seat.room_id]
        previews.append(AssignmentPreviewItem(
            assignment_order=i,
            student_id=str(es.student_id),
            student_number=student.student_number,
            full_name=student.full_name,
            room_id=str(seat.room_id),
            building=room.building,
            room_number=room.room_number,
            seat_id=str(seat.id),
            seat_code=seat.seat_code,
        ))

    return previews, student_count, available_count


# ── Preview ─────────────────────────────────────────────────

def preview_assignment(db: Session, exam_id: UUID) -> dict:
    previews, student_count, available_count = _build_preview(db, exam_id)
    rooms = get_exam_rooms(db, exam_id)
    return {
        "students": student_count,
        "rooms": len(rooms),
        "available_seats": available_count,
        "assigned": len(previews),
        "unused": available_count - len(previews),
        "items": [
            {
                "assignment_order": p.assignment_order,
                "student_number": p.student_number,
                "full_name": p.full_name,
                "building": p.building,
                "room_number": p.room_number,
                "seat_code": p.seat_code,
            }
            for p in previews[:20]
        ],
        "has_more": len(previews) > 20,
    }


# ── Confirm (Generate) ─────────────────────────────────────

def confirm_assignment(db: Session, exam_id: UUID, user_id: UUID) -> dict:
    existing = db.query(ExamAssignment).filter(ExamAssignment.exam_id == exam_id).first()
    if existing:
        raise ValueError("Seating has already been generated. Use regenerate to replace.")

    previews, student_count, available_count = _build_preview(db, exam_id)

    students = _get_sorted_students(db, exam_id)
    seats = _get_sorted_seats(db, exam_id)

    version = 1
    assignments_to_insert = []
    for (es, _student), seat in zip(students, seats):
        assignments_to_insert.append(ExamAssignment(
            exam_id=exam_id,
            exam_student_id=es.id,
            seat_id=seat.id,
            assignment_method="AUTOMATIC",
            version=version,
        ))

    db.add_all(assignments_to_insert)
    db.add(AuditLog(
        user_id=user_id,
        action="SEATING_ASSIGNMENT_CREATED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={
            "student_count": student_count,
            "seat_count": available_count,
            "assignment_count": len(assignments_to_insert),
            "version": version,
        },
    ))
    db.commit()

    return {
        "assigned": len(assignments_to_insert),
        "version": version,
        "student_count": student_count,
        "available_seats": available_count,
    }


# ── Regenerate ──────────────────────────────────────────────

def regenerate_assignment(db: Session, exam_id: UUID, user_id: UUID) -> dict:
    existing_count = db.query(ExamAssignment).filter(ExamAssignment.exam_id == exam_id).count()
    if not existing_count:
        raise ValueError("No existing assignments to regenerate")

    db.query(ExamAssignment).filter(ExamAssignment.exam_id == exam_id).delete()

    previews, student_count, available_count = _build_preview(db, exam_id)

    students = _get_sorted_students(db, exam_id)
    seats = _get_sorted_seats(db, exam_id)

    max_version = db.query(func.max(ExamAssignment.version)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 0
    new_version = max_version + 1

    assignments_to_insert = []
    for (es, _student), seat in zip(students, seats):
        assignments_to_insert.append(ExamAssignment(
            exam_id=exam_id,
            exam_student_id=es.id,
            seat_id=seat.id,
            assignment_method="AUTOMATIC",
            version=new_version,
        ))

    db.add_all(assignments_to_insert)
    db.add(AuditLog(
        user_id=user_id,
        action="SEATING_ASSIGNMENT_REGENERATED",
        entity_type="exam",
        entity_id=exam_id,
        old_values={"previous_count": existing_count},
        new_values={
            "student_count": student_count,
            "seat_count": available_count,
            "assignment_count": len(assignments_to_insert),
            "version": new_version,
        },
    ))
    db.commit()

    return {
        "assigned": len(assignments_to_insert),
        "version": new_version,
        "previous_count": existing_count,
        "student_count": student_count,
        "available_seats": available_count,
    }


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

    return [
        {
            "id": str(a.id),
            "assignment_order": a.version,
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
        }
        for a, s, seat, room in results
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

    assignment = ExamAssignment(
        exam_id=exam_id,
        exam_student_id=exam_student.id,
        seat_id=seat_id,
        assignment_method=method,
        version=1,
    )
    db.add(assignment)

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


def remove_assignment(db: Session, assignment_id: UUID, user_id: UUID) -> bool:
    assignment = db.query(ExamAssignment).filter(ExamAssignment.id == assignment_id).first()
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
