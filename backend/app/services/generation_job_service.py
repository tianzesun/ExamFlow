"""Personalized paper generation as a background job the browser can poll."""

import logging
import time
from datetime import timedelta
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.generation_job import GenerationJob
from app.services import pdf_service
from app.services.exam_status_service import sync_exam_status
from app.utils import utcnow

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = ("QUEUED", "RUNNING")
# A job that has not reported progress for this long was cut off (e.g. a server restart).
STALE_AFTER = timedelta(minutes=10)
# Write progress at most this often; each write is a database round trip.
PROGRESS_INTERVAL_SECONDS = 1.0


def _expire_stale(db: Session, exam_id: UUID) -> None:
    stale = (
        db.query(GenerationJob)
        .filter(
            GenerationJob.exam_id == exam_id,
            GenerationJob.status.in_(ACTIVE_STATUSES),
            GenerationJob.updated_at < utcnow() - STALE_AFTER,
        )
        .all()
    )
    for job in stale:
        job.status = "FAILED"
        job.error = "Generation was interrupted. Start it again."
        job.finished_at = utcnow()
    if stale:
        db.commit()


def get_latest_job(db: Session, exam_id: UUID) -> GenerationJob | None:
    _expire_stale(db, exam_id)
    return (
        db.query(GenerationJob)
        .filter(GenerationJob.exam_id == exam_id)
        .order_by(GenerationJob.created_at.desc())
        .first()
    )


def start_job(db: Session, exam_id: UUID, user_id: UUID) -> GenerationJob:
    """Create a queued job. Raises ValueError if the exam isn't ready or a job is already running."""
    errors = pdf_service.validate_generation(db, exam_id)
    if errors:
        raise ValueError(errors[0])
    _expire_stale(db, exam_id)
    job = GenerationJob(exam_id=exam_id, status="QUEUED", created_by=user_id)
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        # The partial unique index allows one active job per exam.
        db.rollback()
        raise LookupError("Papers are already being generated for this exam") from None
    db.refresh(job)
    return job


def run_job(job_id: UUID) -> None:
    """Run in the background after the response is sent, on its own session.

    Progress is committed mid-run. That is safe because generate_all_exams only adds
    its rows in the final commit; expire_on_commit=False keeps the rows it loaded up
    front from being re-fetched after every progress write.
    """
    db = SessionLocal(expire_on_commit=False)
    try:
        job = db.get(GenerationJob, job_id)
        job.status = "RUNNING"
        db.commit()
        last_write = 0.0

        def on_progress(done: int, total: int) -> None:
            nonlocal last_write
            now = time.monotonic()
            if done < total and now - last_write < PROGRESS_INTERVAL_SECONDS:
                return
            job.done, job.total = done, total
            db.commit()
            last_write = now

        try:
            result = pdf_service.generate_all_exams(db, job.exam_id, job.created_by, on_progress=on_progress)
        except ValueError as e:
            db.rollback()
            job = db.get(GenerationJob, job_id)
            job.status, job.error = "FAILED", str(e)[:500]
        except Exception:
            db.rollback()
            job = db.get(GenerationJob, job_id)
            # The job id doubles as the correlation id shown to the user.
            logger.exception("Paper generation job %s failed", job_id)
            job.status = "FAILED"
            job.error = f"Papers could not be generated. Reference: {job_id}"
        else:
            job.status = "SUCCEEDED"
            job.generated = result["generated"]
            job.generation_version = result["generation_version"]
            sync_exam_status(db, job.exam_id, job.created_by)
        job.finished_at = utcnow()
        db.commit()
    finally:
        db.close()


def to_dict(job: GenerationJob) -> dict:
    return {
        "id": str(job.id),
        "status": job.status,
        "total": job.total,
        "done": job.done,
        "generated": job.generated,
        "generation_version": job.generation_version,
        "error": job.error,
        "created_at": job.created_at.isoformat(),
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }
