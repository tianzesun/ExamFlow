"""Settings an administrator changes in ExamFlow (Admin › Settings).

Each is read where it's used, so a change applies from the next sync, new exam, upload or
sign-in; nothing already done changes. UTORid sign-in can be set here or in the server's
environment, and the environment wins. Other deployment settings (database, URLs, rate
limits) stay in the environment and are only shown here.
"""

import logging
import re
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

import httpx
from pydantic import BaseModel, Field, computed_field, field_validator, model_validator
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.audit_log import AuditLog
from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)

KEY = "system"
SIGN_IN_KEY = "sign_in"
ROLES = ("ADMIN", "STAFF", "INSTRUCTOR", "TA")
_GUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_NAME = re.compile(r"[A-Za-z0-9_.-]{1,100}")


class DefaultSeating(BaseModel):
    """The seating rules a new exam starts with; each exam can still change its own."""

    order: Literal["student_number", "name", "random"] = "student_number"
    spacing: Literal["none", "every_other_seat", "every_other_seat_and_row"] = "none"
    versions: int = Field(1, ge=1, le=4)


class PaperStamp(BaseModel):
    """What is printed on each student's paper besides the room, seat and QR code, which are always there."""

    # Off for anonymous marking: the paper then carries the student number instead of the name.
    show_name: bool = True
    show_utorid: bool = False
    # A slim line on every page after the first, so a page that comes loose can be matched to its student.
    every_page: bool = True

    def fingerprint(self) -> str:
        """Recorded on each paper, so changing what is printed makes papers made before out of date."""
        return f"name={int(self.show_name)};utorid={int(self.show_utorid)};pages={int(self.every_page)}"


DEFAULT_STAMP = PaperStamp().fingerprint()


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
    paper_stamp: PaperStamp = Field(default_factory=PaperStamp)
    # Printed above the title of signature lists, seating lists, seating maps and the exam summary.
    document_heading: str = Field("", max_length=150)
    # What the new-exam form starts with.
    default_duration_minutes: int = Field(120, ge=15, le=600)
    default_start_time: str = ""  # HH:MM, or empty for none

    @computed_field
    @property
    def stamp_style(self) -> str:
        # Stored with the settings so paper_state can compare it to each paper's in SQL.
        return self.paper_stamp.fingerprint()

    @field_validator("document_heading")
    @classmethod
    def _tidy_heading(cls, v: str) -> str:
        return " ".join(v.split())

    @field_validator("default_start_time")
    @classmethod
    def _start_time(cls, v: str) -> str:
        v = v.strip()
        if v and not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", v):
            raise ValueError("The default start time is like 09:00, or empty")
        return v

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


# ── UTORid sign-in (Microsoft Entra ID) ─────────────────────

class SignInSettings(BaseModel):
    """The ExamFlow app registration in Entra. None of it is secret: the browser signs in as a
    single-page app with PKCE, so there is no client secret to store."""

    # Directory (tenant) ID and Application (client) ID; both empty means UTORid sign-in is off.
    tenant_id: str = ""
    client_id: str = ""
    api_scope: str = "access_as_user"
    # ExamFlow role → the Entra app role value that grants it.
    role_values: dict[str, str] = Field(default_factory=lambda: {
        "ADMIN": "ExamFlow.Admin", "STAFF": "ExamFlow.Staff", "INSTRUCTOR": "ExamFlow.Instructor", "TA": "ExamFlow.TA",
    })

    @field_validator("tenant_id", "client_id")
    @classmethod
    def _guid(cls, v: str) -> str:
        v = v.strip().lower()
        if v and not _GUID.fullmatch(v):
            raise ValueError("Tenant and client IDs look like 00000000-0000-0000-0000-000000000000")
        return v

    @field_validator("api_scope")
    @classmethod
    def _scope(cls, v: str) -> str:
        v = v.strip()
        if not _NAME.fullmatch(v):
            raise ValueError("The API scope is a name like access_as_user (letters, digits, . _ -)")
        return v

    @field_validator("role_values")
    @classmethod
    def _role_values(cls, v: dict[str, str]) -> dict[str, str]:
        if set(v) != set(ROLES):
            raise ValueError("Give an Entra app role value for each ExamFlow role")
        v = {role: v[role].strip() for role in ROLES}
        if not all(_NAME.fullmatch(x) for x in v.values()):
            raise ValueError("App role values are names like ExamFlow.Admin (letters, digits, . _ -)")
        if len(set(v.values())) != len(v):
            raise ValueError("Each ExamFlow role needs its own app role value")
        return v

    @model_validator(mode="after")
    def _both_or_neither(self) -> "SignInSettings":
        if bool(self.tenant_id) != bool(self.client_id):
            raise ValueError("Enter both the tenant ID and the client ID, or neither to turn UTORid sign-in off")
        return self


@dataclass(frozen=True)
class EntraConfig:
    tenant_id: str
    client_id: str
    api_scope: str
    # Entra app role value → ExamFlow role.
    role_map: dict[str, str]


def _environment_sign_in() -> SignInSettings | None:
    """UTORid sign-in set in the server's environment, which always wins over Admin › Settings."""
    s = get_settings()
    if not s.entra_enabled:
        return None
    by_role = {role: value for value, role in s.entra_role_map.items()}
    return SignInSettings.model_construct(
        tenant_id=s.ENTRA_TENANT_ID.strip(), client_id=s.ENTRA_CLIENT_ID.strip(), api_scope=s.ENTRA_API_SCOPE,
        role_values={role: by_role.get(role, "") for role in ROLES},
    )


def get_sign_in_settings(db: Session) -> tuple[SignInSettings, str]:
    """The sign-in settings in force, and where they come from: "environment" or "settings"."""
    env = _environment_sign_in()
    if env:
        return env, "environment"
    row = db.get(SystemSetting, SIGN_IN_KEY)
    return SignInSettings(**(row.value if row else {})), "settings"


def entra_config(db: Session) -> EntraConfig | None:
    """How to check UTORid sign-ins, or None when UTORid sign-in isn't set up."""
    settings, _ = get_sign_in_settings(db)
    if not settings.tenant_id:
        return None
    env = _environment_sign_in()
    role_map = get_settings().entra_role_map if env else {v: r for r, v in settings.role_values.items()}
    return EntraConfig(settings.tenant_id, settings.client_id, settings.api_scope, role_map)


class SignInSettingsError(ValueError):
    pass


def _tenant_exists(tenant_id: str) -> bool | None:
    """Whether Microsoft knows the tenant; None if Microsoft couldn't be reached."""
    url = f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"
    try:
        r = httpx.get(url, timeout=10)
    except httpx.HTTPError:
        logger.warning("Couldn't reach Microsoft to check the Entra tenant")
        return None
    return r.status_code == 200


def update_sign_in_settings(db: Session, new: SignInSettings, user_id: UUID) -> SignInSettings:
    """Save the app registration. Refused while the environment sets it, when the tenant doesn't
    exist, and when turning sign-in off would leave nobody able to sign in."""
    if _environment_sign_in():
        raise SignInSettingsError(
            "UTORid sign-in is set in the server's environment, which takes priority. Change it there."
        )
    row = db.get(SystemSetting, SIGN_IN_KEY)
    old = SignInSettings(**(row.value if row else {}))
    if new == old:
        return old
    if not new.tenant_id and not get_settings().dev_auth_enabled:
        raise SignInSettingsError("Turning UTORid sign-in off would leave nobody able to sign in to ExamFlow.")
    if new.tenant_id and new.tenant_id != old.tenant_id and _tenant_exists(new.tenant_id) is False:
        raise SignInSettingsError(
            "Microsoft doesn't know that tenant ID. Copy it from the app registration's Overview page."
        )

    value = new.model_dump(mode="json")
    if row:
        row.value, row.updated_by = value, user_id
    else:
        db.add(SystemSetting(key=SIGN_IN_KEY, value=value, updated_by=user_id))
    before = old.model_dump(mode="json")
    changed = [k for k in value if before.get(k) != value[k]]
    db.add(AuditLog(
        user_id=user_id,
        action="SYSTEM_SIGN_IN_SETTINGS_UPDATED",
        entity_type="system",
        old_values={k: before[k] for k in changed},
        new_values={k: value[k] for k in changed},
    ))
    db.commit()
    return new


# ── Other settings ──────────────────────────────────────────

def get_system_settings(db: Session) -> SystemSettings:
    row = db.get(SystemSetting, KEY)
    return SystemSettings(**(row.value if row else {}))


def update_system_settings(db: Session, new: SystemSettings, user_id: UUID) -> SystemSettings:
    row = db.get(SystemSetting, KEY)
    old = SystemSettings(**(row.value if row else {}))
    before, after = old.model_dump(mode="json"), new.model_dump(mode="json")
    changed = [k for k in SystemSettings.model_fields if before.get(k) != after[k]]
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
        "test_accounts": s.dev_auth_enabled,
        "rate_limits": s.RATE_LIMITS_ENABLED,
        "public_app_url": s.PUBLIC_APP_URL,
        "storage": s.STORAGE_TYPE,
    }
