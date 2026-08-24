"""phase 5 seating assignment

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-24 18:30:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: str | None = 'a1b2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create exam_rooms table
    op.create_table(
        'exam_rooms',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('exam_id', UUID(as_uuid=True), sa.ForeignKey('exams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('room_id', UUID(as_uuid=True), sa.ForeignKey('rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('exam_id', 'room_id', name='uq_exam_room'),
    )
    op.create_index('idx_exam_rooms_exam_id', 'exam_rooms', ['exam_id'])
    op.create_index('idx_exam_rooms_room_id', 'exam_rooms', ['room_id'])

    # Add is_usable to seats
    op.add_column('seats', sa.Column('is_usable', sa.Boolean(), nullable=False, server_default='true'))

    # Add version to exam_assignments
    op.add_column('exam_assignments', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('exam_assignments', 'version')
    op.drop_column('seats', 'is_usable')
    op.drop_index('idx_exam_rooms_room_id', table_name='exam_rooms')
    op.drop_index('idx_exam_rooms_exam_id', table_name='exam_rooms')
    op.drop_table('exam_rooms')
