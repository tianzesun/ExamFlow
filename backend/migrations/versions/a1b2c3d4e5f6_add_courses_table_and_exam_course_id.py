"""add courses table and exam course_id

Revision ID: a1b2c3d4e5f6
Revises: 9ae0bc9a1a92
Create Date: 2026-08-20 22:50:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = '9ae0bc9a1a92'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create courses table
    op.create_table(
        'courses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('course_code', sa.String(50), unique=True, nullable=False),
        sa.Column('course_name', sa.String(255), nullable=False),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # Add course_id FK and academic_year to exams
    op.add_column('exams', sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('exams', sa.Column('academic_year', sa.Integer(), nullable=True))

    # Backfill course_id from existing course_code
    op.execute("""
        UPDATE exams e
        SET course_id = c.id
        FROM courses c
        WHERE e.course_code = c.course_code
    """)

    # Create courses for existing exams that don't have a match
    op.execute("""
        INSERT INTO courses (course_code, course_name)
        SELECT DISTINCT e.course_code, e.course_name
        FROM exams e
        WHERE e.course_id IS NULL
    """)

    # Backfill again for newly created courses
    op.execute("""
        UPDATE exams e
        SET course_id = c.id
        FROM courses c
        WHERE e.course_code = c.course_code AND e.course_id IS NULL
    """)

    # Set academic_year default for existing rows
    op.execute("UPDATE exams SET academic_year = 2026 WHERE academic_year IS NULL")

    # Now make NOT NULL
    op.alter_column('exams', 'course_id', nullable=False)
    op.alter_column('exams', 'academic_year', nullable=False)

    # Add FK constraint
    op.create_foreign_key(
        'fk_exams_course_id',
        'exams', 'courses',
        ['course_id'], ['id']
    )

    # Add index
    op.create_index('idx_exams_course_id', 'exams', ['course_id'])
    op.create_index('idx_courses_course_code', 'courses', ['course_code'])


def downgrade() -> None:
    op.drop_index('idx_courses_course_code', table_name='courses')
    op.drop_index('idx_exams_course_id', table_name='exams')
    op.drop_constraint('fk_exams_course_id', 'exams', type_='foreignkey')
    op.drop_column('exams', 'academic_year')
    op.drop_column('exams', 'course_id')
    op.drop_table('courses')
