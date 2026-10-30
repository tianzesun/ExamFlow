from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.exam_assignment import ExamAssignment
from app.models.exam_room import ExamRoom
from app.models.exam_student import ExamStudent
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam
from app.services import paper_state


@dataclass
class CheckResult:
    name: str
    status: str  # PASS, FAIL, WARN
    message: str
    count: int | None = None
    required: int | None = None


@dataclass
class ReadinessResult:
    ready: bool
    checks: list[CheckResult]


def validate_exam_readiness(db: Session, exam_id: UUID) -> ReadinessResult:
    checks: list[CheckResult] = []

    # 1. Roster check
    roster_count = db.query(func.count(ExamStudent.id)).filter(
        ExamStudent.exam_id == exam_id
    ).scalar() or 0
    checks.append(CheckResult(
        name="roster",
        status="PASS" if roster_count > 0 else "FAIL",
        message=f"{roster_count} students in roster" if roster_count > 0 else "No students in roster",
        count=roster_count,
    ))

    # 2. Rooms check
    room_count = db.query(func.count(ExamRoom.id)).filter(
        ExamRoom.exam_id == exam_id
    ).scalar() or 0
    checks.append(CheckResult(
        name="rooms",
        status="PASS" if room_count > 0 else "FAIL",
        message=f"{room_count} rooms selected" if room_count > 0 else "No rooms selected",
        count=room_count,
    ))

    # 3. Seating check
    assigned_count = db.query(func.count(ExamAssignment.id)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 0
    unassigned = roster_count - assigned_count
    checks.append(CheckResult(
        name="seating",
        status="PASS" if assigned_count > 0 and unassigned == 0 else "FAIL",
        message=f"{assigned_count}/{roster_count} students assigned" if roster_count > 0 else "No assignments",
        count=assigned_count,
        required=roster_count,
    ))

    # 4. Template check: an active paper for every version students are seated for.
    active = {
        t.paper_version: t for t in db.query(ExamTemplate).filter(
            ExamTemplate.exam_id == exam_id,
            ExamTemplate.is_active == True,  # noqa: E712
        )
    }
    needed = {v for (v,) in db.query(ExamAssignment.paper_version).filter(ExamAssignment.exam_id == exam_id).distinct()}
    missing = sorted((needed or {"A"}) - set(active))
    if missing and needed - {"A"}:
        template_message = f"No paper uploaded for version {', '.join(missing)}"
    elif missing:
        template_message = "No active template"
    elif len(active) > 1:
        template_message = f"Versions {', '.join(sorted(active))} uploaded"
    else:
        template_message = f"Template v{next(iter(active.values())).version} active"
    checks.append(CheckResult(
        name="template",
        status="FAIL" if missing else "PASS",
        message=template_message,
    ))

    # 5. Generated exams check
    generated_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id,
        *paper_state.UP_TO_DATE,
    ).scalar() or 0
    # Only up-to-date papers count: a seating change or new template makes the affected ones stale.
    to_update = max(0, assigned_count - generated_count)
    if generated_count == 0:
        documents_message = "No exams generated"
    elif to_update:
        documents_message = f"{generated_count} up to date, {to_update} to generate"
    else:
        documents_message = f"{generated_count} personalized exams generated"
    checks.append(CheckResult(
        name="documents",
        status="PASS" if generated_count > 0 and to_update == 0 else "FAIL",
        message=documents_message,
        count=generated_count,
        required=assigned_count,
    ))

    # 6. QR check
    qr_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.qr_token.isnot(None),
        *paper_state.UP_TO_DATE,
    ).scalar() or 0

    if generated_count == 0:
        qr_status = "WARN"
    elif qr_count == generated_count:
        qr_status = "PASS"
    else:
        qr_status = "FAIL"
    checks.append(CheckResult(
        name="qr",
        status=qr_status,
        message=f"{qr_count}/{generated_count} QR codes generated" if generated_count > 0 else "Generate exams first",
        count=qr_count,
        required=generated_count if generated_count > 0 else None,
    ))

    # Overall readiness
    ready = all(c.status == "PASS" for c in checks)

    return ReadinessResult(ready=ready, checks=checks)


def get_exam_summary(db: Session, exam_id: UUID) -> dict:
    roster_count = db.query(func.count(ExamStudent.id)).filter(
        ExamStudent.exam_id == exam_id
    ).scalar() or 0

    assigned_count = db.query(func.count(ExamAssignment.id)).filter(
        ExamAssignment.exam_id == exam_id
    ).scalar() or 0

    room_count = db.query(func.count(ExamRoom.id)).filter(
        ExamRoom.exam_id == exam_id
    ).scalar() or 0

    generated_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id,
        *paper_state.UP_TO_DATE,
    ).scalar() or 0

    qr_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.qr_token.isnot(None),
        *paper_state.UP_TO_DATE,
    ).scalar() or 0

    active_template = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()

    return {
        "roster_count": roster_count,
        "assigned_count": assigned_count,
        "unassigned_count": roster_count - assigned_count,
        "room_count": room_count,
        "generated_count": generated_count,
        "qr_count": qr_count,
        "has_template": active_template is not None,
        "template_version": active_template.version if active_template else None,
    }


def get_exam_summaries(db: Session, exam_ids: list[UUID]) -> dict[str, dict]:
    """get_exam_summary for many exams at once, using one grouped query per table."""
    if not exam_ids:
        return {}

    def counts(column, *filters):
        return dict(
            db.query(column, func.count())
            .filter(column.in_(exam_ids), *filters)
            .group_by(column)
            .all()
        )

    roster = counts(ExamStudent.exam_id)
    assigned = counts(ExamAssignment.exam_id)
    rooms = counts(ExamRoom.exam_id)
    generated = counts(GeneratedExam.exam_id, *paper_state.UP_TO_DATE)
    qr = counts(GeneratedExam.exam_id, *paper_state.UP_TO_DATE, GeneratedExam.qr_token.isnot(None))
    templates = dict(
        db.query(ExamTemplate.exam_id, ExamTemplate.version)
        .filter(ExamTemplate.exam_id.in_(exam_ids), ExamTemplate.is_active == True)  # noqa: E712
        .all()
    )
    return {
        str(eid): {
            "roster_count": roster.get(eid, 0),
            "assigned_count": assigned.get(eid, 0),
            "unassigned_count": roster.get(eid, 0) - assigned.get(eid, 0),
            "room_count": rooms.get(eid, 0),
            "generated_count": generated.get(eid, 0),
            "qr_count": qr.get(eid, 0),
            "has_template": eid in templates,
            "template_version": templates.get(eid),
        }
        for eid in exam_ids
    }
