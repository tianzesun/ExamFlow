from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base
from app.utils import utcnow


class SystemSetting(Base):
    """Settings an administrator changes in ExamFlow (Admin › Settings), one row per group.

    Deployment settings (database, Entra, URLs) stay in the environment and aren't here.
    """

    __tablename__ = "system_settings"

    key = Column(String(50), primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
