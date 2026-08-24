"""phase 7 generated exams

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-08-24 20:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: str | None = 'c3d4e5f6g7h8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'generated_exams',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('exam_id', UUID(as_uuid=True), sa.ForeignKey('exams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('exam_student_id', UUID(as_uuid=True), sa.ForeignKey('exam_students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('exam_assignment_id', UUID(as_uuid=True), sa.ForeignKey('exam_assignments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('exam_template_id', UUID(as_uuid=True), sa.ForeignKey('exam_templates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('file_name', sa.String(500), nullable=False),
        sa.Column('storage_key', sa.String(1000), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('file_hash', sa.String(128), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='GENERATED'),
        sa.Column('generation_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('exam_id', 'exam_student_id', 'generation_version', name='uq_generated_exam_version'),
    )
    op.create_index('idx_generated_exams_exam_id', 'generated_exams', ['exam_id'])
    op.create_index('idx_generated_exams_exam_student_id', 'generated_exams', ['exam_student_id'])


def downgrade() -> None:
    op.drop_index('idx_generated_exams_exam_student_id', table_name='generated_exams')
    op.drop_index('idx_generated_exams_exam_id', table_name='generated_exams')
    op.drop_table('generated_exams')
