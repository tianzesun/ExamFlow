from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    from app.auth.dev_auth import verify_dev_token
    from app.auth.entra import NoExamFlowRoleError, looks_like_jwt, verify_entra_token

    token = credentials.credentials
    try:
        # UTORid sign-ins carry an Entra access token (a JWT); test accounts a short fixed token.
        user = verify_entra_token(token, db) if looks_like_jwt(token) else verify_dev_token(token, db)
    except NoExamFlowRoleError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your UTORid doesn't have access to ExamFlow yet. Ask the exam office to give you a role.",
        ) from None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


def require_role(*roles: str):
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role} not authorized. Required: {', '.join(roles)}",
            )
        return user
    return role_checker
