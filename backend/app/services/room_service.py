from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.room import Room
from app.models.seat import Seat


def create_room(db: Session, building: str, room_number: str, capacity: int, user_id: UUID) -> Room:
    existing = db.query(Room).filter(Room.building == building, Room.room_number == room_number).first()
    if existing:
        raise ValueError(f"Room {building} {room_number} already exists")

    room = Room(building=building, room_number=room_number, capacity=capacity)
    db.add(room)
    db.flush()

    for row in range(1, min(capacity // 10 + 2, 20)):
        for col in range(1, min(11, capacity + 1)):
            seat_code = f"{chr(64 + row)}{col:02d}"
            if (row - 1) * 10 + col > capacity:
                break
            db.add(Seat(room_id=room.id, seat_code=seat_code, row_number=row, column_number=col))

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
