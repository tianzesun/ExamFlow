"""Deleting exam data once its retention period has passed (Admin › Settings › Keeping data).

Every period is empty (keep) until set, so nothing is deleted until an administrator turns it on. Each
exam touched is archived, so it can't be changed afterwards; the exam itself, its rooms and the audit
log stay. Runs daily (main.py) and on demand from Admin › Settings.
"""

import logging
import os
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.exam_student import ExamStudent
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam
from app.models.student import Student
from app.services.settings_service import Retention, get_system_settings
from app.services.template_service import get_template_path

logger = logging.getLogger(__name__)

# Only one server process runs the clean-up at a time.
_LOCK_KEY = 0x45584D_52455400  # "EXM RET"


def _due(db: Session, days: int | None) -> list[UUID]:
    """Exams whose date is at least days ago; none while the period is empty."""
    if not days:
        return []
    cutoff = date.today() - timedelta(days=days)
    return [row[0] for row in db.query(Exam.id).filter(Exam.exam_date.isnot(None), Exam.exam_date <= cutoff)]


def _orphan_students(db: Session):
    return db.query(Student).filter(~select(ExamStudent.id).where(ExamStudent.student_id == Student.id).exists())


def plan(db: Session, retention: Retention | None = None) -> dict:
    """What a run would delete now, without deleting anything."""
    retention = retention or get_system_settings(db).retention
    papers, exam_papers, rosters = (_due(db, retention.papers_days), _due(db, retention.exam_papers_days),
                                    _due(db, retention.rosters_days))

    def count(model, column, exam_ids) -> int:
        if not exam_ids:
            return 0
        return db.query(func.count(model.id)).filter(column.in_(exam_ids)).scalar() or 0

    return {
        "papers": count(GeneratedExam, GeneratedExam.exam_id, papers),
        "exam_papers": count(ExamTemplate, ExamTemplate.exam_id, exam_papers),
        "roster_entries": count(ExamStudent, ExamStudent.exam_id, rosters),
        "exams": len(set(papers) | set(exam_papers) | set(rosters)),
    }


def _remove_files(paths: list[str]) -> None:
    for path in paths:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass


def run(db: Session, user_id: UUID | None = None) -> dict:
    """Delete what is due and archive the exams it came from. Returns what was deleted."""
    got_lock = db.execute(select(func.pg_try_advisory_xact_lock(_LOCK_KEY))).scalar()
    if not got_lock:
        return {"papers": 0, "exam_papers": 0, "roster_entries": 0, "students": 0, "exams": 0, "skipped": True}
    retention = get_system_settings(db).retention
    files: list[str] = []
    done: dict[UUID, dict] = {}

    def note(exam_id: UUID, what: str, n: int) -> None:
        if n:
            done.setdefault(exam_id, {})[what] = n

    for exam_id in _due(db, retention.papers_days):
        rows = db.query(GeneratedExam).filter(GeneratedExam.exam_id == exam_id).all()
        files += [ge.storage_key for ge in rows]
        for ge in rows:
            db.delete(ge)
        note(exam_id, "papers", len(rows))

    for exam_id in _due(db, retention.exam_papers_days):
        rows = db.query(ExamTemplate).filter(ExamTemplate.exam_id == exam_id).all()
        files += [get_template_path(t) for t in rows]
        for t in rows:
            db.delete(t)
        note(exam_id, "exam_papers", len(rows))

    students = 0
    for exam_id in _due(db, retention.rosters_days):
        # The papers name the students, so they go with the roster, including those kept for removed students.
        papers = db.query(GeneratedExam).filter(GeneratedExam.exam_id == exam_id)
        files += [ge.storage_key for ge in papers]
        papers.delete(synchronize_session=False)
        n = db.query(ExamStudent).filter(ExamStudent.exam_id == exam_id).delete(synchronize_session=False)
        note(exam_id, "roster_entries", n)
    if retention.rosters_days:
        db.flush()
        students = _orphan_students(db).delete(synchronize_session=False)

    for exam_id, counts in done.items():
        exam = db.get(Exam, exam_id)
        old_status = exam.status
        exam.status = "ARCHIVED"
        db.add(AuditLog(
            user_id=user_id,
            action="RETENTION_APPLIED",
            entity_type="exam",
            entity_id=exam_id,
            old_values={"status": old_status},
            new_values={**counts, "status": "ARCHIVED"},
        ))
    if students:
        db.add(AuditLog(user_id=user_id, action="UNUSED_STUDENTS_DELETED", entity_type="student",
                        new_values={"count": students}))
    db.commit()
    # Files go only once the records are gone, so a failed run leaves nothing pointing at missing files.
    _remove_files(files)

    totals = {what: sum(c.get(what, 0) for c in done.values()) for what in ("papers", "exam_papers", "roster_entries")}
    result = {**totals, "students": students, "exams": len(done)}
    if done or students:
        logger.info("Retention: %s", result)
    return result
