from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.auth.dev_auth import DEV_USERS, verify_dev_token
from app.config import get_settings
from app.database import get_db
from app.models.user import User

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


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)) -> User:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


@router.post("/login", response_model=UserResponse)
def dev_login(request: DevLoginRequest, db: Session = Depends(get_db)) -> User:
    """Development login endpoint.
    In production, this would be replaced by OIDC callback.
    """
    if settings.APP_ENV == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development login not available in production",
        )

    if not settings.AUTH_DEV_MODE:
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
    if settings.APP_ENV == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not available in production",
        )

    if not settings.AUTH_DEV_MODE:
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
