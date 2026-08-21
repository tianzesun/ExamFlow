from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, Field


class ExamCreate(BaseModel):
    course_id: UUID
    exam_name: str = Field(..., min_length=1, max_length=255)
    term: str = Field(..., min_length=1, max_length=50)
    academic_year: int = Field(..., ge=2020, le=2100)
    exam_date: date
    start_time: time
    duration_minutes: int = Field(..., gt=0, le=600)


class ExamUpdate(BaseModel):
    exam_name: str | None = Field(None, min_length=1, max_length=255)
    term: str | None = Field(None, min_length=1, max_length=50)
    academic_year: int | None = Field(None, ge=2020, le=2100)
    exam_date: date | None = None
    start_time: time | None = None
    duration_minutes: int | None = Field(None, gt=0, le=600)
    status: str | None = None


class ExamResponse(BaseModel):
    id: UUID
    course_id: UUID
    course_code: str
    course_name: str | None
    exam_name: str
    term: str
    academic_year: int
    exam_date: date
    start_time: time
    duration_minutes: int
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExamListResponse(BaseModel):
    exams: list[ExamResponse]
    total: int
    page: int
    page_size: int
