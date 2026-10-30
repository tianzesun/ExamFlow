from datetime import date
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.exam_assignment import ExamAssignment
from app.models.room import Room
from app.models.seat import Seat

SEATS_PER_ROW = 10


def _row_label(row: int) -> str:
    """1 -> A, 26 -> Z, 27 -> AA (spreadsheet-style)."""
    label = ""
    while row > 0:
        row, rem = divmod(row - 1, 26)
        label = chr(65 + rem) + label
    return label


def _seat_at(room_id: UUID, row: int, col: int) -> Seat:
    return Seat(room_id=room_id, seat_code=f"{_row_label(row)}{col:02d}", row_number=row, column_number=col)


def _build_seat(room_id: UUID, index: int, columns: int = SEATS_PER_ROW) -> Seat:
    row, col = divmod(index, columns)
    return _seat_at(room_id, row + 1, col + 1)


def _columns(room: Room) -> int:
    return (room.layout or {}).get("columns") or SEATS_PER_ROW


def default_aisles(columns: int) -> list[int]:
    """Rooms without a saved layout show one centre aisle once they're wide enough."""
    return [-(-columns // 2)] if columns >= 8 else []


def _clean_aisles(aisles_after: list[int], columns: int) -> list[int]:
    return sorted({a for a in aisles_after if 0 < a < columns})


def _sync_seats(db: Session, room: Room, capacity: int) -> None:
    """Grow or shrink the seat grid to match capacity. Refuses to drop seats that are assigned."""
    seats = get_room_seats(db, room.id)
    columns = _columns(room)
    if capacity > len(seats):
        taken = {(s.row_number, s.column_number) for s in seats}
        index = 0
        while len(taken) < capacity:
            row, col = divmod(index, columns)
            if (row + 1, col + 1) not in taken:
                db.add(_seat_at(room.id, row + 1, col + 1))
                taken.add((row + 1, col + 1))
            index += 1
    else:
        extra = seats[capacity:]
        extra_ids = [s.id for s in extra]
        if extra_ids and db.query(ExamAssignment.id).filter(ExamAssignment.seat_id.in_(extra_ids)).first():
            raise ValueError("Cannot reduce capacity: seats being removed are assigned to students")
        for seat in extra:
            db.delete(seat)
    if room.layout:
        db.flush()
        rows = max((s.row_number or 0 for s in get_room_seats(db, room.id)), default=0)
        room.layout = {**room.layout, "rows": rows}


def create_room(
    db: Session,
    building: str,
    room_number: str,
    capacity: int | None,
    user_id: UUID,
    rows: int | None = None,
    columns: int | None = None,
    aisles_after: list[int] | None = None,
) -> Room:
    """A room from a capacity (10 seats a row) or from rows × seats per row."""
    existing = db.query(Room).filter(Room.building == building, Room.room_number == room_number).first()
    if existing:
        raise ValueError(f"Room {building} {room_number} already exists")

    layout = None
    if rows and columns:
        capacity = rows * columns
        layout = {"rows": rows, "columns": columns, "aisles_after": _clean_aisles(aisles_after or [], columns)}
    if not capacity:
        raise ValueError("Give the room a capacity, or rows and seats per row")
    room = Room(building=building, room_number=room_number, capacity=capacity, layout=layout)
    db.add(room)
    db.flush()

    for index in range(capacity):
        db.add(_build_seat(room.id, index, columns or SEATS_PER_ROW))

    db.add(AuditLog(
        user_id=user_id,
        action="ROOM_CREATED",
        entity_type="room",
        entity_id=room.id,
        new_values={"building": building, "room_number": room_number, "capacity": capacity},
    ))
    db.commit()
    db.refresh(room)
    return room


def get_rooms(db: Session, skip: int = 0, limit: int = 50) -> tuple[list[Room], int]:
    from sqlalchemy import func
    total = db.query(func.count(Room.id)).scalar()
    rooms = db.query(Room).order_by(Room.building, Room.room_number).offset(skip).limit(limit).all()
    return rooms, total


def get_room(db: Session, room_id: UUID) -> Room | None:
    return db.query(Room).filter(Room.id == room_id).first()


def get_room_seats(db: Session, room_id: UUID) -> list[Seat]:
    return db.query(Seat).filter(Seat.room_id == room_id).order_by(Seat.row_number, Seat.column_number).all()


def delete_room(db: Session, room_id: UUID, user_id: UUID) -> bool:
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        return False

    in_use = (
        db.query(ExamAssignment.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .filter(Seat.room_id == room_id)
        .first()
    )
    if in_use:
        raise ValueError("This room has students seated in it. Remove it from those exams first.")

    db.add(AuditLog(
        user_id=user_id,
        action="ROOM_DELETED",
        entity_type="room",
        entity_id=room.id,
        old_values={"building": room.building, "room_number": room.room_number},
    ))
    db.delete(room)
    db.commit()
    return True


def update_room(
    db: Session,
    room_id: UUID,
    building: str | None = None,
    room_number: str | None = None,
    capacity: int | None = None,
    is_active: bool | None = None,
    user_id: UUID | None = None,
) -> Room | None:
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        return None
    new_building, new_number = building or room.building, room_number or room.room_number
    clash = db.query(Room.id).filter(
        Room.building == new_building, Room.room_number == new_number, Room.id != room.id
    ).first()
    if clash:
        raise ValueError(f"Room {new_building} {new_number} already exists")

    old_values = {}
    if building is not None and building != room.building:
        old_values["building"] = room.building
        room.building = building
    if room_number is not None and room_number != room.room_number:
        old_values["room_number"] = room.room_number
        room.room_number = room_number
    if capacity is not None and capacity != room.capacity:
        old_values["capacity"] = room.capacity
        _sync_seats(db, room, capacity)
        room.capacity = capacity
    if is_active is not None and is_active != room.is_active:
        old_values["is_active"] = room.is_active
        room.is_active = is_active

    if old_values and user_id:
        db.add(AuditLog(
            user_id=user_id,
            action="ROOM_UPDATED",
            entity_type="room",
            entity_id=room.id,
            old_values=old_values,
        ))

    db.commit()
    db.refresh(room)
    return room


def get_room_usage(db: Session) -> dict[str, dict]:
    """Per room: seat counts and how full it gets at its busiest upcoming exam."""
    seats = dict(
        db.query(Seat.room_id, func.count(Seat.id)).group_by(Seat.room_id).all()
    )
    blocked = dict(
        db.query(Seat.room_id, func.count(Seat.id)).filter(Seat.status != "AVAILABLE").group_by(Seat.room_id).all()
    )
    per_exam = (
        db.query(Seat.room_id, ExamAssignment.exam_id, func.count(ExamAssignment.id))
        .join(ExamAssignment, ExamAssignment.seat_id == Seat.id)
        .join(Exam, Exam.id == ExamAssignment.exam_id)
        .filter(Exam.exam_date >= date.today(), Exam.status != "ARCHIVED")
        .group_by(Seat.room_id, ExamAssignment.exam_id)
        .all()
    )
    upcoming: dict = {}
    for room_id, _exam_id, n in per_exam:
        u = upcoming.setdefault(room_id, {"upcoming_exams": 0, "peak_assigned": 0})
        u["upcoming_exams"] += 1
        u["peak_assigned"] = max(u["peak_assigned"], n)
    return {
        str(room_id): {
            "seats": seats.get(room_id, 0),
            "blocked": blocked.get(room_id, 0),
            **upcoming.get(room_id, {"upcoming_exams": 0, "peak_assigned": 0}),
        }
        for room_id in set(seats) | set(upcoming)
    }


# ── Layout editor ──────────────────────────────────────────

MAX_ROWS = 52
MAX_COLUMNS = 60


def room_layout(room: Room, seats: list[Seat]) -> dict:
    """rows, columns and aisles_after for drawing the room, saved or worked out from its seats."""
    saved = room.layout or {}
    rows = max(saved.get("rows") or 0, max((s.row_number or 0 for s in seats), default=0))
    columns = max(saved.get("columns") or 0, max((s.column_number or 0 for s in seats), default=0))
    aisles = saved["aisles_after"] if "aisles_after" in saved else default_aisles(columns)
    return {"rows": rows, "columns": columns, "aisles_after": _clean_aisles(aisles, columns)}


def _seat_bookings(db: Session, seat_ids: list[UUID]) -> dict[UUID, dict]:
    """Per seat: how many exams seat a student there, and how many of those are still to come."""
    rows = (
        db.query(ExamAssignment.seat_id, Exam.exam_date, Exam.status)
        .join(Exam, Exam.id == ExamAssignment.exam_id)
        .filter(ExamAssignment.seat_id.in_(seat_ids))
        .all()
    ) if seat_ids else []
    today = date.today()
    out: dict[UUID, dict] = {}
    for seat_id, exam_date, exam_status in rows:
        b = out.setdefault(seat_id, {"exams": 0, "upcoming": 0})
        b["exams"] += 1
        if exam_status != "ARCHIVED" and (exam_date is None or exam_date >= today):
            b["upcoming"] += 1
    return out


def get_layout(db: Session, room_id: UUID) -> dict | None:
    room = get_room(db, room_id)
    if not room:
        return None
    seats = get_room_seats(db, room_id)
    bookings = _seat_bookings(db, [s.id for s in seats])
    return {
        **room_layout(room, seats),
        "seats": [
            {
                "seat_code": s.seat_code,
                "row": s.row_number,
                "column": s.column_number,
                "is_usable": s.is_usable,
                "exams": bookings.get(s.id, {}).get("exams", 0),
                "upcoming": bookings.get(s.id, {}).get("upcoming", 0),
            }
            for s in seats
        ],
    }


def _codes(seats: list[Seat], limit: int = 5) -> str:
    codes = sorted(s.seat_code for s in seats)
    more = f" and {len(codes) - limit} more" if len(codes) > limit else ""
    return ", ".join(codes[:limit]) + more


def save_layout(
    db: Session,
    room_id: UUID,
    rows: int,
    columns: int,
    aisles_after: list[int],
    missing: list[tuple[int, int]],
    blocked: list[tuple[int, int]],
    user_id: UUID,
) -> dict | None:
    """Reshape the room. Seats keep their ids (and codes), so seating already planned stays put.

    missing: grid positions with no seat (a pillar, the lectern, a short row).
    blocked: seats that exist but aren't used for exams (broken, too close to the door).
    """
    room = get_room(db, room_id)
    if not room:
        return None
    if not (1 <= rows <= MAX_ROWS and 1 <= columns <= MAX_COLUMNS):
        raise ValueError(f"A room can have 1–{MAX_ROWS} rows and 1–{MAX_COLUMNS} seats per row")

    seats = get_room_seats(db, room_id)
    by_pos = {(s.row_number, s.column_number): s for s in seats if s.row_number and s.column_number}
    wanted = {(r, c) for r in range(1, rows + 1) for c in range(1, columns + 1)} - set(missing)
    blocked_set = set(blocked) & wanted
    if not wanted - blocked_set:
        raise ValueError("Leave at least one seat in use")

    bookings = _seat_bookings(db, [s.id for s in seats])
    removed = [s for pos, s in by_pos.items() if pos not in wanted]
    booked = [s for s in removed if s.id in bookings]
    if booked:
        raise ValueError(
            f"Seats {_codes(booked)} have students seated in them for an exam, so they can't be removed. "
            "Mark them as not in use instead, or move those students first."
        )
    newly_blocked = [s for pos, s in by_pos.items() if pos in blocked_set and s.is_usable]
    upcoming = [s for s in newly_blocked if bookings.get(s.id, {}).get("upcoming")]
    if upcoming:
        raise ValueError(
            f"Seats {_codes(upcoming)} have students seated in them for an upcoming exam. "
            "Move those students before taking the seats out of use."
        )

    old = {**room_layout(room, seats), "capacity": room.capacity}
    for seat in removed:
        db.delete(seat)
    for pos in sorted(wanted - set(by_pos)):
        db.add(_seat_at(room.id, *pos))
    db.flush()
    for seat in get_room_seats(db, room_id):
        usable = (seat.row_number, seat.column_number) not in blocked_set
        seat.is_usable = usable
        seat.status = "AVAILABLE" if usable else "BLOCKED"

    room.layout = {"rows": rows, "columns": columns, "aisles_after": _clean_aisles(aisles_after, columns)}
    room.capacity = len(wanted) - len(blocked_set)
    db.add(AuditLog(
        user_id=user_id,
        action="ROOM_LAYOUT_UPDATED",
        entity_type="room",
        entity_id=room.id,
        old_values=old,
        new_values={
            **room.layout, "capacity": room.capacity, "missing": len(set(missing)), "blocked": len(blocked_set),
        },
    ))
    db.commit()
    db.refresh(room)
    return get_layout(db, room_id)
