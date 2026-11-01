from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.auth.dev_auth import DEV_USERS, verify_dev_token
from app.config import get_settings
from app.database import get_db
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
def get_me(user: User = Depends(get_current_user)) -> User:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


@router.post("/login", response_model=UserResponse, dependencies=[Depends(per_address("sign-in", 10, 60))])
def dev_login(request: DevLoginRequest, db: Session = Depends(get_db)) -> User:
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

    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


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
