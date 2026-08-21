from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    course_code: str = Field(..., min_length=1, max_length=50)
    course_name: str = Field(..., min_length=1, max_length=255)
    department: str | None = Field(None, max_length=100)


class CourseUpdate(BaseModel):
    course_code: str | None = Field(None, min_length=1, max_length=50)
    course_name: str | None = Field(None, min_length=1, max_length=255)
    department: str | None = Field(None, max_length=100)


class CourseResponse(BaseModel):
    id: UUID
    course_code: str
    course_name: str
    department: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CourseListResponse(BaseModel):
    courses: list[CourseResponse]
    total: int
