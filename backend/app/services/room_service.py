from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
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


def _build_seat(room_id: UUID, index: int) -> Seat:
    row, col = divmod(index, SEATS_PER_ROW)
    return Seat(
        room_id=room_id,
        seat_code=f"{_row_label(row + 1)}{col + 1:02d}",
        row_number=row + 1,
        column_number=col + 1,
    )


def _sync_seats(db: Session, room: Room, capacity: int) -> None:
    """Grow or shrink the seat grid to match capacity. Refuses to drop seats that are assigned."""
    from app.models.exam_assignment import ExamAssignment

    seats = get_room_seats(db, room.id)
    if capacity > len(seats):
        for index in range(len(seats), capacity):
            db.add(_build_seat(room.id, index))
        return

    extra = seats[capacity:]
    if not extra:
        return
    extra_ids = [s.id for s in extra]
    if db.query(ExamAssignment.id).filter(ExamAssignment.seat_id.in_(extra_ids)).first():
        raise ValueError("Cannot reduce capacity: seats being removed are assigned to students")
    for seat in extra:
        db.delete(seat)


def create_room(db: Session, building: str, room_number: str, capacity: int, user_id: UUID) -> Room:
    existing = db.query(Room).filter(Room.building == building, Room.room_number == room_number).first()
    if existing:
        raise ValueError(f"Room {building} {room_number} already exists")

    room = Room(building=building, room_number=room_number, capacity=capacity)
    db.add(room)
    db.flush()

    for index in range(capacity):
        db.add(_build_seat(room.id, index))

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
