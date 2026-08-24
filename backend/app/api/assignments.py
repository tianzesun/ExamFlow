from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.services import assignment_service

router = APIRouter(prefix="/api/exams/{exam_id}/assignments", tags=["assignments"])


# ── Request / Response Models ───────────────────────────────

class AssignRequest(BaseModel):
    student_id: UUID
    seat_id: UUID


class ExamRoomRequest(BaseModel):
    room_id: UUID


class AssignmentResponse(BaseModel):
    id: str
    assignment_order: int
    student_id: str
    student_number: str
    full_name: str
    seat_code: str
    seat_id: str
    room_id: str
    building: str
    room_number: str
    method: str
    version: int


class AssignmentSummaryResponse(BaseModel):
    registered_students: int
    assigned_students: int
    unassigned_students: int
    available_seats: int
    unused_seats: int
    rooms_used: int
    room_details: list[dict]


class AssignmentListResponse(BaseModel):
    assignments: list[dict]
    total: int
    page: int
    page_size: int


# ── Exam Room Selection ─────────────────────────────────────

@router.get("/rooms", response_model=list[dict])
def list_exam_rooms(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    rooms = assignment_service.get_exam_rooms(db, exam_id)
    return [
        {"id": str(r.id), "building": r.building, "room_number": r.room_number, "capacity": r.capacity}
        for r in rooms
    ]


@router.post("/rooms", status_code=status.HTTP_201_CREATED)
def add_exam_room(
    exam_id: UUID,
    data: ExamRoomRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        exam_room = assignment_service.add_exam_room(db, exam_id, data.room_id)
        return {"id": str(exam_room.id), "room_id": str(exam_room.room_id)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_exam_room(
    exam_id: UUID,
    room_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        if not assignment_service.remove_exam_room(db, exam_id, room_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not selected for this exam")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── Summary ─────────────────────────────────────────────────

@router.get("/summary", response_model=AssignmentSummaryResponse)
def get_summary(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return assignment_service.get_summary(db, exam_id)


# ── Preview / Confirm / Regenerate ──────────────────────────

@router.post("/preview")
def preview_assignment(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        return assignment_service.preview_assignment(db, exam_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/confirm")
def confirm_assignment(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        return assignment_service.confirm_assignment(db, exam_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/regenerate")
def regenerate_assignment(
    exam_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        return assignment_service.regenerate_assignment(db, exam_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── List / Search ───────────────────────────────────────────

@router.get("", response_model=AssignmentListResponse)
def list_assignments(
    exam_id: UUID,
    query: str | None = Query(None),
    room_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    assignments, total = assignment_service.search_assignments(
        db, exam_id, query=query, room_id=room_id, page=page, page_size=page_size
    )
    return AssignmentListResponse(
        assignments=assignments, total=total, page=page, page_size=page_size
    )


# ── Single Operations ───────────────────────────────────────

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def assign_seat(
    exam_id: UUID,
    data: AssignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        assignment = assignment_service.assign_student(
            db, exam_id, data.student_id, data.seat_id, user.id
        )
        assignments = assignment_service.get_assignments(db, exam_id)
        return next(a for a in assignments if a["id"] == str(assignment.id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_assignment(
    exam_id: UUID,
    assignment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    if not assignment_service.remove_assignment(db, assignment_id, user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
