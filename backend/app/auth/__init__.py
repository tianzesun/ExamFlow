from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

security = HTTPBearer(auto_error=False)


NO_ROLE_DETAIL = "Your UTORid doesn't have access to ExamFlow yet. Ask the exam office to give you a role."


def authenticate(token: str, db: Session) -> User | None:
    """The user a bearer token belongs to, or None if it isn't valid.

    Raises NoExamFlowRoleError for a valid UTORid sign-in without an ExamFlow role.
    """
    from app.auth.dev_auth import verify_dev_token
    from app.auth.entra import looks_like_jwt, verify_entra_token

    # UTORid sign-ins carry an Entra access token (a JWT); test accounts a short fixed token.
    return verify_entra_token(token, db) if looks_like_jwt(token) else verify_dev_token(token, db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    from app.auth.entra import NoExamFlowRoleError

    try:
        user = authenticate(credentials.credentials, db)
    except NoExamFlowRoleError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NO_ROLE_DETAIL) from None

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
