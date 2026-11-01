"""generated_exams.stamp_style: what the paper's stamp showed

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
"""

from alembic import op
import sqlalchemy as sa

revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_exams", sa.Column("stamp_style", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("generated_exams", "stamp_style")
