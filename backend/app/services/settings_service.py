"""Settings an administrator changes in ExamFlow (Admin › Settings).

Each is read where it's used, so a change applies from the next sync, new exam or upload;
nothing already done changes. Deployment settings (database, Entra, URLs) stay in the
environment and are only shown, never edited, here.
"""

import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.audit_log import AuditLog
from app.models.system_setting import SystemSetting

KEY = "system"


class DefaultSeating(BaseModel):
    """The seating rules a new exam starts with; each exam can still change its own."""

    order: Literal["student_number", "name", "random"] = "student_number"
    spacing: Literal["none", "every_other_seat", "every_other_seat_and_row"] = "none"
    versions: int = Field(1, ge=1, le=4)


class SystemSettings(BaseModel):
    # Given to courses the Timetable Builder sync adds.
    department_name: str = Field("Computer Science", min_length=1, max_length=120)
    # Timetable Builder division whose courses are synced, e.g. ARTSC for the Faculty of Arts & Science.
    ttb_division: str = "ARTSC"
    # Course code prefixes taken from that division, e.g. CSC.
    ttb_subjects: list[str] = Field(default_factory=lambda: ["CSC"], min_length=1, max_length=10)
    default_seating: DefaultSeating = Field(default_factory=DefaultSeating)
    # Largest exam paper PDF that may be uploaded.
    max_upload_mb: int = Field(50, ge=1, le=200)

    @field_validator("department_name")
    @classmethod
    def _tidy_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("Enter a department name")
        return v

    @field_validator("ttb_division")
    @classmethod
    def _division(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.fullmatch(r"[A-Z]{2,10}", v):
            raise ValueError("A division code is 2 to 10 letters, e.g. ARTSC")
        return v

    @field_validator("ttb_subjects")
    @classmethod
    def _subjects(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for s in (s.strip().upper() for s in v):
            if not re.fullmatch(r"[A-Z]{2,4}", s):
                raise ValueError(f"“{s}” isn't a course code prefix; use 2 to 4 letters, e.g. CSC")
            if s not in out:
                out.append(s)
        return out


def get_system_settings(db: Session) -> SystemSettings:
    row = db.get(SystemSetting, KEY)
    return SystemSettings(**(row.value if row else {}))


def update_system_settings(db: Session, new: SystemSettings, user_id: UUID) -> SystemSettings:
    row = db.get(SystemSetting, KEY)
    old = SystemSettings(**(row.value if row else {}))
    before, after = old.model_dump(mode="json"), new.model_dump(mode="json")
    changed = [k for k in after if before.get(k) != after[k]]
    if not changed:
        return old
    if row:
        row.value, row.updated_by = after, user_id
    else:
        db.add(SystemSetting(key=KEY, value=after, updated_by=user_id))
    db.add(AuditLog(
        user_id=user_id,
        action="SYSTEM_SETTINGS_UPDATED",
        entity_type="system",
        old_values={k: before[k] for k in changed},
        new_values={k: after[k] for k in changed},
    ))
    db.commit()
    return new


def deployment_info() -> dict:
    """How this server is set up, for the Settings page; nothing here is secret."""
    s = get_settings()
    return {
        "environment": s.APP_ENV,
        "utorid_sign_in": s.entra_enabled,
        "test_accounts": s.dev_auth_enabled,
        "rate_limits": s.RATE_LIMITS_ENABLED,
        "public_app_url": s.PUBLIC_APP_URL,
        "storage": s.STORAGE_TYPE,
    }
