"""generated_exams.room_label: the room printed on the paper

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
"""

from alembic import op
import sqlalchemy as sa

revision = "t0u1v2w3x4y5"
down_revision = "s9t0u1v2w3x4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("generated_exams", sa.Column("room_label", sa.String(160), nullable=True))


def downgrade() -> None:
    op.drop_column("generated_exams", "room_label")
