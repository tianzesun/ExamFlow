from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.exam_assignment import ExamAssignment
from app.models.exam_student import ExamStudent
from app.models.seat import Seat
from app.models.student import Student


def assign_student(
    db: Session,
    exam_id: UUID,
    student_id: UUID,
    seat_id: UUID,
    user_id: UUID,
    method: str = "MANUAL",
) -> ExamAssignment:
    exam_student = db.query(ExamStudent).filter(
        ExamStudent.exam_id == exam_id,
        ExamStudent.student_id == student_id,
    ).first()
    if not exam_student:
        raise ValueError("Student not in exam roster")

    existing = db.query(ExamAssignment).filter(
        ExamAssignment.exam_id == exam_id,
        ExamAssignment.exam_student_id == exam_student.id,
    ).first()
    if existing:
        raise ValueError("Student already assigned to a seat")

    seat_taken = db.query(ExamAssignment).filter(
        ExamAssignment.exam_id == exam_id,
        ExamAssignment.seat_id == seat_id,
    ).first()
    if seat_taken:
        raise ValueError("Seat already assigned")

    seat = db.query(Seat).filter(Seat.id == seat_id).first()
    if not seat or seat.status != "AVAILABLE":
        raise ValueError("Seat not available")

    assignment = ExamAssignment(
        exam_id=exam_id,
        exam_student_id=exam_student.id,
        seat_id=seat_id,
        assignment_method=method,
    )
    db.add(assignment)

    student = db.query(Student).filter(Student.id == student_id).first()
    db.add(AuditLog(
        user_id=user_id,
        action="SEAT_ASSIGNED",
        entity_type="exam_assignment",
        entity_id=assignment.id,
        new_values={"student_number": student.student_number if student else "", "seat_id": str(seat_id)},
    ))
    db.commit()
    db.refresh(assignment)
    return assignment


def get_assignments(db: Session, exam_id: UUID) -> list[dict]:
    results = (
        db.query(ExamAssignment, Student, Seat)
        .join(ExamStudent, ExamAssignment.exam_student_id == ExamStudent.id)
        .join(Student, ExamStudent.student_id == Student.id)
        .join(Seat, ExamAssignment.seat_id == Seat.id)
        .filter(ExamAssignment.exam_id == exam_id)
        .order_by(Student.student_number)
        .all()
    )
    return [
        {
            "id": str(a.id),
            "student_id": str(s.id),
            "student_number": s.student_number,
            "full_name": s.full_name,
            "seat_code": seat.seat_code,
            "seat_id": str(seat.id),
            "room_id": str(seat.room_id),
            "method": a.assignment_method,
        }
        for a, s, seat in results
    ]


def remove_assignment(db: Session, assignment_id: UUID, user_id: UUID) -> bool:
    assignment = db.query(ExamAssignment).filter(ExamAssignment.id == assignment_id).first()
    if not assignment:
        return False

    db.add(AuditLog(
        user_id=user_id,
        action="SEAT_UNASSIGNED",
        entity_type="exam_assignment",
        entity_id=assignment.id,
        old_values={"seat_id": str(assignment.seat_id)},
    ))
    db.delete(assignment)
    db.commit()
    return True


def auto_assign(db: Session, exam_id: UUID, room_id: UUID, user_id: UUID) -> dict:
    unassigned = (
        db.query(ExamStudent, Student)
        .join(Student, ExamStudent.student_id == Student.id)
        .filter(ExamStudent.exam_id == exam_id)
        .filter(~ExamStudent.id.in_(
            db.query(ExamAssignment.exam_student_id).filter(ExamAssignment.exam_id == exam_id)
        ))
        .order_by(Student.student_number)
        .all()
    )

    available_seats = (
        db.query(Seat)
        .filter(Seat.room_id == room_id, Seat.status == "AVAILABLE")
        .filter(~Seat.id.in_(
            db.query(ExamAssignment.seat_id).filter(ExamAssignment.exam_id == exam_id)
        ))
        .order_by(Seat.row_number, Seat.column_number)
        .all()
    )

    assigned = 0
    for (es, student), seat in zip(unassigned, available_seats):
        assignment = ExamAssignment(
            exam_id=exam_id,
            exam_student_id=es.id,
            seat_id=seat.id,
            assignment_method="AUTOMATIC",
        )
        db.add(assignment)
        assigned += 1

    db.add(AuditLog(
        user_id=user_id,
        action="SEATS_AUTO_ASSIGNED",
        entity_type="exam",
        entity_id=exam_id,
        new_values={"room_id": str(room_id), "assigned": assigned},
    ))
    db.commit()
    return {"assigned": assigned}
