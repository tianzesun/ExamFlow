from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StudentResponse(BaseModel):
    id: UUID
    student_number: str
    full_name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExamStudentResponse(BaseModel):
    id: UUID
    exam_id: UUID
    student_id: UUID
    student_number: str
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
