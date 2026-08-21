from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import require_role
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminTestResponse(BaseModel):
    message: str
    user_id: str
    role: str


@router.get("/test", response_model=AdminTestResponse)
def admin_test(user: User = Depends(require_role("ADMIN"))) -> AdminTestResponse:
    """Test endpoint for ADMIN role verification.
    Phase 1 development endpoint - remove in later phases if not needed.
    """
    return AdminTestResponse(
        message="Admin access verified",
        user_id=str(user.id),
        role=user.role,
    )
