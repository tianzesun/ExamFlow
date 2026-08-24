from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.exam_assignment import ExamAssignment
from app.models.exam_room import ExamRoom
from app.models.exam_student import ExamStudent
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam


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

    # 4. Template check
    active_template = db.query(ExamTemplate).filter(
        ExamTemplate.exam_id == exam_id,
        ExamTemplate.is_active == True,  # noqa: E712
    ).first()
    checks.append(CheckResult(
        name="template",
        status="PASS" if active_template else "FAIL",
        message=f"Template v{active_template.version} active" if active_template else "No active template",
    ))

    # 5. Generated exams check
    generated_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.status == "GENERATED",
    ).scalar() or 0
    checks.append(CheckResult(
        name="documents",
        status="PASS" if generated_count > 0 else "FAIL",
        message=f"{generated_count} personalized exams generated" if generated_count > 0 else "No exams generated",
        count=generated_count,
    ))

    # 6. QR check
    qr_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.qr_token.isnot(None),
        GeneratedExam.status == "GENERATED",
    ).scalar() or 0

    qr_status = "PASS" if (qr_count == generated_count and generated_count > 0) else "WARN"
    if generated_count > 0 and qr_count != generated_count:
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
        GeneratedExam.status == "GENERATED",
    ).scalar() or 0

    qr_count = db.query(func.count(GeneratedExam.id)).filter(
        GeneratedExam.exam_id == exam_id,
        GeneratedExam.qr_token.isnot(None),
        GeneratedExam.status == "GENERATED",
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
