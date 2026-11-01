from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import NO_ROLE_DETAIL, authenticate, get_current_user, security
from app.auth.dev_auth import DEV_USERS, verify_dev_token
from app.auth.entra import NoExamFlowRoleError
from app.config import get_settings
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.rate_limit import per_address

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class UserResponse(BaseModel):
    id: str
    email: str | None
    display_name: str
    role: str
    is_active: bool


class DevLoginRequest(BaseModel):
    token: str


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


@router.get("/config")
def get_auth_config() -> dict:
    """How the sign-in page should offer sign-in. Public: none of this is secret."""
    entra = None
    if settings.entra_enabled:
        client = settings.ENTRA_CLIENT_ID.strip()
        entra = {
            "tenant_id": settings.ENTRA_TENANT_ID.strip(),
            "client_id": client,
            "scopes": [f"api://{client}/{settings.ENTRA_API_SCOPE}"],
        }
    return {"entra": entra, "test_accounts": settings.dev_auth_enabled}


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)) -> UserResponse:
    return _user_response(user)


def _record(db: Session, action: str, user: User | None, **values) -> None:
    db.add(AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity_type="user",
        entity_id=user.id if user else None,
        new_values=values,
    ))
    db.commit()


def _source(user: User) -> str:
    return "UTORid" if user.external_id.startswith("entra:") else "test account"


@router.post(
    "/signed-in",
    response_model=UserResponse,
    dependencies=[Depends(per_address("sign-in-record", 10, 60))],
)
def record_sign_in(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Called once when a UTORid sign-in comes back from Microsoft, so the audit log shows it.

    Token renewals during the session aren't sign-ins and don't come here. A university
    account without an ExamFlow role, or one switched off here, is recorded as refused.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user = authenticate(credentials.credentials, db)
    except NoExamFlowRoleError as e:
        _record(db, "USER_SIGN_IN_REFUSED", None, email=e.email, reason="no ExamFlow role", source="UTORid")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NO_ROLE_DETAIL) from None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    if not user.is_active:
        _record(db, "USER_SIGN_IN_REFUSED", user, reason="switched off in ExamFlow", source=_source(user))
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    _record(db, "USER_SIGNED_IN", user, source=_source(user))
    return _user_response(user)


@router.post("/signed-out", status_code=status.HTTP_204_NO_CONTENT)
def record_sign_out(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    """Called just before the browser signs out, so the audit log shows it."""
    _record(db, "USER_SIGNED_OUT", user, source=_source(user))


@router.post("/login", response_model=UserResponse, dependencies=[Depends(per_address("sign-in", 10, 60))])
def dev_login(request: DevLoginRequest, db: Session = Depends(get_db)) -> UserResponse:
    """Development login endpoint.
    In production, this would be replaced by OIDC callback.
    """
    if not settings.dev_auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development authentication is disabled",
        )

    user = verify_dev_token(request.token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid development token",
        )
    if not user.is_active:
        _record(db, "USER_SIGN_IN_REFUSED", user, reason="switched off in ExamFlow", source="test account")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    _record(db, "USER_SIGNED_IN", user, source="test account")

    return _user_response(user)


@router.get("/dev-tokens")
def get_dev_tokens():
    """Get available development tokens.
    Only available in development mode.
    """
    if not settings.dev_auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development authentication is disabled",
        )

    return {
        "tokens": [
            {"token": token, "role": data["role"], "name": data["display_name"]}
            for token, data in DEV_USERS.items()
        ]
    }
