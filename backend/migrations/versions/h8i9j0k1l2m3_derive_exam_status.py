"""derive exam status from data

Statuses DRAFT..GENERATED are now set automatically from the roster, rooms,
seating and generated papers (see app/services/exam_status_service.py). This
brings existing exams in line once; COMPLETED and ARCHIVED are left alone.

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
"""

from alembic import op

revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        WITH counts AS (
            SELECT e.id,
                (SELECT count(*) FROM exam_students s WHERE s.exam_id = e.id) AS roster,
                (SELECT count(*) FROM exam_rooms r WHERE r.exam_id = e.id) AS rooms,
                (SELECT count(*) FROM exam_assignments a WHERE a.exam_id = e.id) AS assigned,
                (SELECT count(*) FROM generated_exams g
                    WHERE g.exam_id = e.id AND g.status = 'GENERATED') AS generated
            FROM exams e
            WHERE e.status NOT IN ('COMPLETED', 'ARCHIVED')
        )
        UPDATE exams SET status = CASE
            WHEN c.roster = 0 OR c.rooms = 0 THEN 'DRAFT'
            WHEN c.assigned < c.roster THEN 'CONFIGURED'
            WHEN c.generated < c.assigned THEN 'READY'
            ELSE 'GENERATED'
        END
        FROM counts c
        WHERE exams.id = c.id
        """
    )


def downgrade() -> None:
    # Previous statuses were set by hand and aren't recoverable; nothing to undo.
    pass
