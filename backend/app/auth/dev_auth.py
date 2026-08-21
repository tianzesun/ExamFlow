from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import User

settings = get_settings()

# Development users - ONLY for development mode
DEV_USERS = {
    "dev-admin-token": {
        "external_id": "dev-admin@example.local",
        "email": "admin@example.local",
        "display_name": "Dev Admin",
        "role": "ADMIN",
    },
    "dev-staff-token": {
        "external_id": "dev-staff@example.local",
        "email": "staff@example.local",
        "display_name": "Dev Staff",
        "role": "STAFF",
    },
    "dev-instructor-token": {
        "external_id": "dev-instructor@example.local",
        "email": "instructor@example.local",
        "display_name": "Dev Instructor",
        "role": "INSTRUCTOR",
    },
}


def verify_dev_token(token: str, db: Session) -> User | None:
    """Verify development authentication token.
    This function ONLY works in development mode.
    In production, this should never be called.
    """
    if settings.APP_ENV == "production":
        return None

    if not settings.AUTH_DEV_MODE:
        return None

    user_data = DEV_USERS.get(token)
    if not user_data:
        return None

    # JIT user provisioning
    user = db.query(User).filter(User.external_id == user_data["external_id"]).first()

    if not user:
        user = User(
            external_id=user_data["external_id"],
            email=user_data["email"],
            display_name=user_data["display_name"],
            role=user_data["role"],
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update user info if needed
        user.display_name = user_data["display_name"]
        user.email = user_data["email"]
        user.role = user_data["role"]
        db.commit()

    return user


def get_dev_login_url() -> str:
    """Get the development login URL."""
    if settings.APP_ENV == "production":
        raise RuntimeError("Development auth not available in production")
    return "/auth/dev-login"
