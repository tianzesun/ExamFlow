"""Which generated papers still match the student's seat and the active template.

A paper stays valid (its QR code verifies) until it is replaced, but it is only
up to date while the student sits in the seat printed on it, the template it
was made from is still the active one for the student's paper version, the stamp
shows what Admin › Settings asks for, and the exam title, room and student details are the current ones. Seating
changes and a new template therefore make just the affected papers out of date, and only
those need generating and printing again.
"""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import Integer, cast, func, not_, or_, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam import Exam
from app.models.exam_assignment import ExamAssignment
from app.models.exam_student import ExamStudent
from app.models.exam_template import ExamTemplate
from app.models.generated_exam import GeneratedExam
from app.models.room import Room
from app.models.seat import Seat
from app.models.student import Student
from app.models.system_setting import SystemSetting
from app.services.settings_service import DEFAULT_STAMP, KEY
from app.utils import utcnow

# Papers carry a VERSION badge while the exam uses several versions, or anyone still sits at a seat
# given another version. Switching between one and several versions therefore dates every paper.
_shows_version = or_(
    select(Exam.id).where(
        Exam.id == GeneratedExam.exam_id,
        func.coalesce(cast(Exam.seating_rules["versions"].astext, Integer), 1) > 1,
    ).correlate(GeneratedExam).exists(),
    select(ExamAssignment.id).where(
        ExamAssignment.exam_id == GeneratedExam.exam_id, ExamAssignment.paper_version != "A",
    ).correlate(GeneratedExam).exists(),
)


# The stamp Admin › Settings asks for now; papers from before it was recorded used the default.
_stamp_matches = func.coalesce(GeneratedExam.stamp_style, DEFAULT_STAMP) == func.coalesce(
    select(SystemSetting.value["stamp_style"].astext).where(SystemSetting.key == KEY).scalar_subquery(),
    DEFAULT_STAMP,
)


def shows_version(db: Session, exam_id: UUID) -> bool:
    """Whether papers made now for this exam carry a VERSION badge; matches _shows_version."""
    versions = (db.query(Exam.seating_rules).filter(Exam.id == exam_id).scalar() or {}).get("versions") or 1
    return versions > 1 or db.query(ExamAssignment.id).filter(
        ExamAssignment.exam_id == exam_id, ExamAssignment.paper_version != "A"
    ).first() is not None


def exam_title(exam: Exam) -> str:
    """The line printed at the top of each paper, recorded on it so renaming the exam dates the paper."""
    return f"{exam.course_code} — {exam.exam_name}"


def exam_times(exam: Exam) -> str:
    """"Monday, December 28 · 9:00 AM to 11:00 AM", for door signs and the cover sheet of each room's stack."""
    when = exam.exam_date.strftime("%A, %B %-d") if exam.exam_date else ""
    if exam.start_time and exam.exam_date:
        start = datetime.combine(exam.exam_date, exam.start_time)
        end = start + timedelta(minutes=exam.duration_minutes)
        when += f" · {start.strftime('%-I:%M %p')} to {end.strftime('%-I:%M %p')}"
    return when


# The title the exam has now; papers from before it was recorded are taken to match.
_title_matches = or_(
    GeneratedExam.exam_title.is_(None),
    select(Exam.id).where(
        Exam.id == GeneratedExam.exam_id, GeneratedExam.exam_title == Exam.course_code + " — " + Exam.exam_name,
    ).correlate(GeneratedExam).exists(),
)


def room_label(room: Room) -> str:
    """The room as the stamp prints it, recorded on the paper so renaming the room dates the paper."""
    return f"{room.building} {room.room_number}"


# The name the paper's room has now; papers from before it was recorded are taken to match.
_room_matches = or_(
    GeneratedExam.room_label.is_(None),
    select(Seat.id).join(Room, Room.id == Seat.room_id).where(
        Seat.id == GeneratedExam.seat_id, GeneratedExam.room_label == Room.building + " " + Room.room_number,
    ).correlate(GeneratedExam).exists(),
)


# The student's name and UTORid now, where the paper printed them; papers that didn't are taken to match.
_student_matches = or_(
    (GeneratedExam.student_name.is_(None)) & (GeneratedExam.student_utorid.is_(None)),
    select(Student.id).join(ExamStudent, ExamStudent.student_id == Student.id).where(
        ExamStudent.id == GeneratedExam.exam_student_id,
        or_(GeneratedExam.student_name.is_(None), GeneratedExam.student_name == Student.full_name),
        or_(GeneratedExam.student_utorid.is_(None), GeneratedExam.student_utorid == func.coalesce(Student.utorid, "")),
    ).correlate(GeneratedExam).exists(),
)


def printed_student(student, stamp) -> tuple[str | None, str | None]:
    """(name, UTORid) as the stamp prints them, recorded on the paper; None where it doesn't print them."""
    return (
        student.full_name if stamp.show_name else None,
        (student.utorid or "") if stamp.show_utorid else None,
    )


# Correlated to the paper explicitly, so it still works in queries that also join seats or templates.
# The student must still hold the seat printed on the paper, and the paper's template must be the
# active upload for the version that seat now has.
_matches = (
    select(ExamAssignment.id)
    .join(ExamTemplate, ExamTemplate.id == GeneratedExam.exam_template_id)
    .where(
        ExamAssignment.exam_student_id == GeneratedExam.exam_student_id,
        ExamAssignment.seat_id == GeneratedExam.seat_id,
        ExamTemplate.is_active == True,  # noqa: E712
        ExamTemplate.paper_version == ExamAssignment.paper_version,
        or_(GeneratedExam.version_shown.is_(None), GeneratedExam.version_shown == _shows_version),
        _stamp_matches,
        _title_matches,
        _room_matches,
        _student_matches,
    )
    .correlate(GeneratedExam)
    .exists()
)

# Filters for a current paper that matches its student's seat and the active template.
UP_TO_DATE = (GeneratedExam.status == "GENERATED", _matches)
OUTDATED = (GeneratedExam.status == "GENERATED", not_(_matches))


def up_to_date_student_ids(db: Session, exam_id: UUID) -> set[UUID]:
    """exam_student ids whose current paper needs no changes."""
    rows = db.query(GeneratedExam.exam_student_id).filter(GeneratedExam.exam_id == exam_id, *UP_TO_DATE)
    return {row[0] for row in rows}


def is_up_to_date(db: Session, generated_exam_id: UUID) -> bool:
    return db.query(GeneratedExam.id).filter(GeneratedExam.id == generated_exam_id, *UP_TO_DATE).first() is not None


# A printed copy that is no longer the student's paper: replaced by a newer one, out of date and waiting
# to be replaced, or its student was removed from the roster. Until staff take it out of the stack, it
# could be handed out.
_TO_PULL = (
    GeneratedExam.printed_at.isnot(None),
    GeneratedExam.pulled_at.is_(None),
    or_(GeneratedExam.status != "GENERATED", not_(_matches)),
)


def papers_to_pull(db: Session, exam_id: UUID, room_id: UUID | None = None) -> list[dict]:
    """Printed papers to take out of the stacks, room by room in seat order.

    Only while the exam is still to come; afterwards the stacks are gone.
    """
    from app.services.admin_service import seat_order

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam or exam.status == "ARCHIVED" or (exam.exam_date and exam.exam_date < date.today()):
        return []
    q = (
        db.query(GeneratedExam, Seat, Room, Student)
        .outerjoin(Seat, Seat.id == GeneratedExam.seat_id)
        .outerjoin(Room, Room.id == Seat.room_id)
        .outerjoin(ExamStudent, ExamStudent.id == GeneratedExam.exam_student_id)
        .outerjoin(Student, Student.id == ExamStudent.student_id)
        .filter(GeneratedExam.exam_id == exam_id, *_TO_PULL)
    )
    if room_id:
        q = q.filter(Seat.room_id == room_id)
    rows = sorted(q.all(), key=lambda r: (
        r[0].room_label or (room_label(r[2]) if r[2] else ""), seat_order(r[1]) if r[1] else (0, 0, ""),
    ))
    return [
        {
            "id": str(ge.id),
            # What the paper shows, so it can be found in the stack.
            "room": ge.room_label or (room_label(room) if room else ""),
            "room_id": str(room.id) if room else None,
            "seat_code": seat.seat_code if seat else "",
            "student_number": student.student_number if student else None,
            "full_name": student.full_name if student else None,
            "reason": "removed" if ge.exam_student_id is None
            else "out_of_date" if ge.status == "GENERATED" else "replaced",
        }
        for ge, seat, room, student in rows
    ]


PULL_REASONS = {
    "removed": "Student removed from the roster",
    "out_of_date": "Out of date; a new paper is needed",
    "replaced": "Replaced by a newer paper",
}


def mark_pulled(db: Session, exam_id: UUID, ids: list[UUID], user_id: UUID) -> int:
    """Record that these printed papers were taken out of the stacks."""
    papers = db.query(GeneratedExam).filter(
        GeneratedExam.exam_id == exam_id, GeneratedExam.id.in_(ids), *_TO_PULL
    ).all()
    now = utcnow()
    for ge in papers:
        ge.pulled_at = now
    if papers:
        db.add(AuditLog(
            user_id=user_id,
            action="PRINTED_PAPERS_PULLED",
            entity_type="exam",
            entity_id=exam_id,
            new_values={"count": len(papers)},
        ))
    db.commit()
    return len(papers)


def paper_counts(db: Session, exam_id: UUID) -> dict:
    seated = db.query(func.count(ExamAssignment.id)).filter(ExamAssignment.exam_id == exam_id).scalar() or 0

    def count(*filters) -> int:
        return db.query(func.count(GeneratedExam.id)).filter(GeneratedExam.exam_id == exam_id, *filters).scalar() or 0

    up_to_date = count(*UP_TO_DATE)
    outdated = count(*OUTDATED)
    return {
        "seated": seated,
        "up_to_date": up_to_date,
        "outdated": outdated,
        # Seated students without an up-to-date paper, whether theirs is out of date or missing.
        "to_generate": max(0, seated - up_to_date),
        "not_printed": count(*UP_TO_DATE, GeneratedExam.printed_at.is_(None)),
        # Printed copies to take out of the stacks.
        "to_pull": len(papers_to_pull(db, exam_id)),
    }
