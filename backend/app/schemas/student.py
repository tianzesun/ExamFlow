from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class StudentResponse(BaseModel):
    id: UUID
    student_number: str
    full_name: str
    utorid: str | None = None
    email: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExamStudentResponse(BaseModel):
    id: UUID
    exam_id: UUID
    student_id: UUID
    student_number: str
    full_name: str
    utorid: str | None = None
    email: str | None = None
    attendance_status: str = "EXPECTED"
    checked_in_at: datetime | None = None
    extra_time_minutes: int = 0
    accommodation_notes: str | None = None
    # Where the student sits, once seating is done: shown at check-in to send them to the right place.
    room: str | None = None
    seat_code: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttendanceUpdate(BaseModel):
    attendance_status: Literal["EXPECTED", "PRESENT", "ABSENT"]


class AccommodationUpdate(BaseModel):
    extra_time_minutes: int = Field(0, ge=0, le=600)
    accommodation_notes: str | None = Field(None, max_length=2000)


class AttendanceSummary(BaseModel):
    expected: int
    present: int
    absent: int
    total: int


class RosterImportPreview(BaseModel):
    total_rows: int
    valid_rows: int
    duplicate_in_file: int
    already_in_roster: int
    new_students: int
    errors: list[str]
    preview: list[dict]


class RosterImportConfirm(BaseModel):
    exam_id: UUID
    students: list[dict]


class RosterStats(BaseModel):
    total_students: int
    exam_id: UUID
