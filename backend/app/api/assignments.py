from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.services import assignment_service

router = APIRouter(prefix="/api/exams/{exam_id}/assignments", tags=["assignments"])


class AssignRequest(BaseModel):
    student_id: UUID
    seat_id: UUID


class AutoAssignRequest(BaseModel):
    room_id: UUID


class AssignmentResponse(BaseModel):
    id: str
    student_id: str
    student_number: str
    full_name: str
    seat_code: str
    seat_id: str
    room_id: str
    method: str


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    exam_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return assignment_service.get_assignments(db, exam_id)


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
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


@router.post("/auto", response_model=dict)
def auto_assign(
    exam_id: UUID,
    data: AutoAssignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "STAFF")),
):
    try:
        result = assignment_service.auto_assign(db, exam_id, data.room_id, user.id)
        return result
    except Exception as e:
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
