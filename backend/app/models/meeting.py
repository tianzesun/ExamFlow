"""
Meeting model for course sections/schedules from TTB.
"""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils import utcnow


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    section_code = Column(String(20), nullable=False)
    semester = Column(String(20), nullable=False)
    day = Column(String(10))
    start_time = Column(String(10))
    end_time = Column(String(10))
    building = Column(String(100))
    room = Column(String(50))
    instructors = Column(String(500))
    max_capacity = Column(Integer, default=0)
    current_enrolment = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    course = relationship("Course", backref="meetings")
