"""
TTB API endpoints for syncing courses from UofT's Timetable Builder.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.ttb_service import (
    fetch_courses,
    fetch_reference_data,
    sync_cs_courses_to_db,
)

router = APIRouter(prefix="/api/ttb", tags=["TTB"])


@router.get("/reference-data")
async def get_reference_data():
    """Get available sessions, divisions, and campuses from TTB."""
    try:
        data = await fetch_reference_data()
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/courses")
async def get_courses(
    session: str = "20269",
    division: str = "ARTSC",
    subject: str = "CSC",
    level: str = "100/A",
    page: int = 1,
    limit: int = 50,
):
    """Fetch courses from TTB without storing."""
    try:
        result = await fetch_courses(
            session_code=session,
            division_code=division,
            subject_code=subject,
            course_level=level,
            page=page,
            limit=limit,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync")
async def sync_cs_courses(
    semester: str = "20269",
    db: Session = Depends(get_db),
):
    """Sync CS courses from TTB to database."""
    try:
        count = await sync_cs_courses_to_db(db, semester)
        return {"status": "success", "synced": count, "semester": semester}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
