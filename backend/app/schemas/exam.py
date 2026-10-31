from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


def _local_time(value: time | None) -> time | None:
    """Exam times are Toronto wall-clock times; an offset would be silently dropped by the database."""
    if value is not None and value.tzinfo is not None:
        raise ValueError("Give the start time without a time zone, e.g. 09:00")
    return value


class ExamCreate(BaseModel):
    course_id: UUID
    exam_name: str = Field(..., min_length=1, max_length=255)
    term: str = Field(..., min_length=1, max_length=50)
    academic_year: int = Field(..., ge=2020, le=2100)
    exam_date: date
    start_time: time
    duration_minutes: int = Field(..., gt=0, le=600)
    notes: str | None = Field(None, max_length=5000)

    _check_start_time = field_validator("start_time")(_local_time)


class ExamUpdate(BaseModel):
    exam_name: str | None = Field(None, min_length=1, max_length=255)
    term: str | None = Field(None, min_length=1, max_length=50)
    academic_year: int | None = Field(None, ge=2020, le=2100)
    exam_date: date | None = None
    start_time: time | None = None
    duration_minutes: int | None = Field(None, gt=0, le=600)
    notes: str | None = Field(None, max_length=5000)
    status: str | None = None

    _check_start_time = field_validator("start_time")(_local_time)

    @model_validator(mode="after")
    def _no_nulls(self):
        # Leaving a field out keeps it; only notes can be cleared.
        cleared = sorted(f for f in self.model_fields_set if f != "notes" and getattr(self, f) is None)
        if cleared:
            raise ValueError(f"{', '.join(cleared)} can't be empty")
        return self


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
    notes: str | None = None
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
