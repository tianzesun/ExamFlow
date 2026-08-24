from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.services import room_service

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


class RoomCreate(BaseModel):
    building: str
    room_number: str
    capacity: int


class RoomResponse(BaseModel):
    id: UUID
    building: str
    room_number: str
    capacity: int
    is_active: bool

    model_config = {"from_attributes": True}


class SeatResponse(BaseModel):
    id: UUID
    seat_code: str
    row_number: int | None
    column_number: int | None
    status: str

    model_config = {"from_attributes": True}


@router.get("", response_model=dict)
def list_rooms(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    rooms, total = room_service.get_rooms(db, skip=(page - 1) * page_size, limit=page_size)
    return {"rooms": [RoomResponse.model_validate(r).model_dump() for r in rooms], "total": total}


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    try:
        room = room_service.create_room(db, data.building, data.room_number, data.capacity, user.id)
        return room
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    room = room_service.get_room(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


@router.get("/{room_id}/seats", response_model=list[SeatResponse])
def get_room_seats(
    room_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return room_service.get_room_seats(db, room_id)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    if not room_service.delete_room(db, room_id, user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
