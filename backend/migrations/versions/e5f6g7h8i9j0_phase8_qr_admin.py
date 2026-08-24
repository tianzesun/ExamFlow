"""phase 8 qr codes and administration package

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-08-24 21:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5f6g7h8i9j0'
down_revision: str | None = 'd4e5f6g7h8i9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('generated_exams', sa.Column('qr_token', sa.String(64), nullable=True, unique=True))
    op.add_column('generated_exams', sa.Column('qr_generated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('generated_exams', 'qr_generated_at')
    op.drop_column('generated_exams', 'qr_token')
