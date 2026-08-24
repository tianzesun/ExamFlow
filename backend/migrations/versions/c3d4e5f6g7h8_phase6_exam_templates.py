"""phase 6 exam templates

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-08-24 19:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g7h8'
down_revision: str | None = 'b2c3d4e5f6g7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'exam_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('exam_id', UUID(as_uuid=True), sa.ForeignKey('exams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('original_filename', sa.String(500), nullable=False),
        sa.Column('stored_filename', sa.String(500), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('file_hash', sa.String(128), nullable=False),
        sa.Column('template_type', sa.String(50), nullable=False, server_default='CROWDMARK_EXPORT'),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('crowdmark_exam_id', sa.String(255), nullable=True),
        sa.Column('crowdmark_url', sa.String(1000), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('exam_id', 'version', name='uq_exam_template_version'),
    )
    op.create_index('idx_exam_templates_exam_id', 'exam_templates', ['exam_id'])
    op.create_index('idx_exam_templates_file_hash', 'exam_templates', ['file_hash'])


def downgrade() -> None:
    op.drop_index('idx_exam_templates_file_hash', table_name='exam_templates')
    op.drop_index('idx_exam_templates_exam_id', table_name='exam_templates')
    op.drop_table('exam_templates')
