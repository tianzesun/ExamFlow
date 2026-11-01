"""
TTB API endpoints for syncing courses from UofT's Timetable Builder.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.services.ttb_service import (
    UpstreamError,
    fetch_courses,
    fetch_reference_data,
    sync_cs_courses_to_db,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ttb", tags=["TTB"])


@router.get("/reference-data")
async def get_reference_data(_user: User = Depends(get_current_user)):
    """Get available sessions, divisions, and campuses from TTB."""
    try:
        data = await fetch_reference_data()
        return {"status": "success", "data": data}
    except Exception:
        logger.exception("Timetable Builder request failed")
        raise HTTPException(status_code=502, detail="The Timetable Builder could not be reached. Try again later.")


@router.get("/courses")
async def get_courses(
    session: str = "20269",
    division: str = "ARTSC",
    subject: str = "CSC",
    level: str = "100/A",
    page: int = 1,
    limit: int = 50,
    _user: User = Depends(get_current_user),
):
    """Fetch courses from TTB without storing."""
    try:
        result = await fetch_courses(
            session_code=session,
            division_code=division,
            subject_prefix=subject,
        )
        # Note: course-level filtering ("100/A") is not applied here because the
        # parsed TTB payload does not include a course-level field. Pagination is
        # applied client-side since TTB returns the full course list.
        start = (page - 1) * limit
        return {"status": "success", "data": result[start : start + limit], "total": len(result)}
    except Exception:
        logger.exception("Timetable Builder request failed")
        raise HTTPException(status_code=502, detail="The Timetable Builder could not be reached. Try again later.")


@router.post("/sync")
async def sync_cs_courses(
    semester: str = Query(..., pattern=r"^\d{4}[159]$", description="TTB session code, e.g. 20269 for Fall 2026"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    """Bring the term's CS courses and meeting times in line with TTB."""
    try:
        result = await sync_cs_courses_to_db(db, semester, user.id)
    except UpstreamError:
        logger.exception("Timetable Builder request failed")
        raise HTTPException(status_code=502, detail="The Timetable Builder could not be reached. Try again later.")
    # Anything else (e.g. a database error) is ours, not TTB's: the error handler answers 500 with a reference.
    return {"status": "success", "semester": semester, **result}
