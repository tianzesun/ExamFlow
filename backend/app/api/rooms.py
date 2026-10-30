from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.services import room_service

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


class RoomCreate(BaseModel):
    building: str
    room_number: str
    capacity: int | None = Field(None, gt=0, le=2000)
    # Or lay the room out as rows × seats per row.
    rows: int | None = Field(None, ge=1, le=room_service.MAX_ROWS)
    columns: int | None = Field(None, ge=1, le=room_service.MAX_COLUMNS)
    aisles_after: list[int] = Field(default_factory=list, max_length=room_service.MAX_COLUMNS)


class LayoutUpdate(BaseModel):
    rows: int = Field(..., ge=1, le=room_service.MAX_ROWS)
    columns: int = Field(..., ge=1, le=room_service.MAX_COLUMNS)
    aisles_after: list[int] = Field(default_factory=list, max_length=room_service.MAX_COLUMNS)
    missing: list[tuple[int, int]] = Field(default_factory=list, max_length=5000)
    blocked: list[tuple[int, int]] = Field(default_factory=list, max_length=5000)


class RoomUpdate(BaseModel):
    building: str | None = None
    room_number: str | None = None
    capacity: int | None = Field(None, gt=0, le=2000)
    is_active: bool | None = None


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


@router.get("/usage", response_model=dict)
def room_usage(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return room_service.get_room_usage(db)


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    try:
        room = room_service.create_room(
            db, data.building, data.room_number, data.capacity, user.id,
            rows=data.rows, columns=data.columns, aisles_after=data.aisles_after,
        )
        return room
    except ValueError as e:
        code = status.HTTP_409_CONFLICT if "already exists" in str(e) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


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


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: UUID,
    data: RoomUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    try:
        room = room_service.update_room(
            db, room_id,
            building=data.building,
            room_number=data.room_number,
            capacity=data.capacity,
            is_active=data.is_active,
            user_id=user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


@router.get("/{room_id}/layout", response_model=dict)
def get_room_layout(
    room_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    layout = room_service.get_layout(db, room_id)
    if layout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return layout


@router.put("/{room_id}/layout", response_model=dict)
def save_room_layout(
    room_id: UUID,
    data: LayoutUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    try:
        layout = room_service.save_layout(
            db, room_id, data.rows, data.columns, data.aisles_after, data.missing, data.blocked, user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if layout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return layout


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
    try:
        deleted = room_service.delete_room(db, room_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
