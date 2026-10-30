"""paper versions: templates and seat assignments carry a version letter (A-D)

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
"""

from alembic import op
import sqlalchemy as sa

revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, check in (("exam_templates", "ck_exam_templates_paper_version"),
                         ("exam_assignments", "ck_exam_assignments_paper_version")):
        op.add_column(table, sa.Column("paper_version", sa.String(1), nullable=False, server_default="A"))
        op.create_check_constraint(check, table, "paper_version IN ('A', 'B', 'C', 'D')")


def downgrade() -> None:
    for table, check in (("exam_templates", "ck_exam_templates_paper_version"),
                         ("exam_assignments", "ck_exam_assignments_paper_version")):
        op.drop_constraint(check, table, type_="check")
        op.drop_column(table, "paper_version")
