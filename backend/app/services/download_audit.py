"""Record who downloaded which exam documents. Papers and lists carry student details, so every
download is in the audit log, under the exam it belongs to."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def record_download(db: Session, user: User, action: str, exam_id: UUID, **details) -> None:
    db.add(AuditLog(user_id=user.id, action=action, entity_type="exam", entity_id=exam_id, new_values=details))
    db.commit()
