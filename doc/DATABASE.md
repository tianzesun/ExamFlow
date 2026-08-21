ExamFlow Database Design

File: DATABASE.md
Version: 1.0
Status: Proposed
Last Updated: 2026-08-19

1. Purpose

This document defines the PostgreSQL database architecture for ExamFlow.

The database stores the minimum information required to manage university examination administration.

The database must remain:

Simple
Normalized
Secure
Auditable
Consistent
Maintainable

ExamFlow must not become a replacement for the University's Student Information System (SIS).

ExamFlow stores only the student information required for examination administration.

2. Database Principles
2.1 PostgreSQL

PostgreSQL is the primary relational database.

Application
     |
     v
SQLAlchemy
     |
     v
PostgreSQL
2.2 Database Is Authoritative for Integrity

Important business rules must be enforced at the database level where practical.

For example:

Two students cannot occupy the same seat for the same exam.

This should not rely only on application code.

3. Core Data Model

The initial database contains the following core tables:

users
exams
students
exam_students
rooms
seats
exam_assignments
documents
audit_logs

Relationship:

                    users
                      │
                      │
                      ▼
                    exams
                 /    │    \
                /     │     \
               ▼      ▼      ▼
          exam_students rooms documents
               │          │
               ▼          ▼
           students      seats
                           │
                           │
                           ▼
                   exam_assignments
                      │           │
                      ▼           ▼
                   students      seats
4. Entity Overview
Table	Purpose
users	ExamFlow application users
exams	Examination definitions
students	Minimal student records
exam_students	Students registered for an exam
rooms	Examination rooms
seats	Physical seats within rooms
exam_assignments	Student → Room → Seat assignment
documents	Generated document metadata
audit_logs	Administrative audit trail
5. users

Stores ExamFlow users.

CREATE TABLE users (
    id UUID PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
Fields
id

Internal UUID.

Never expose sequential database IDs unnecessarily.

external_id

University SSO identifier.

Example:

tsun
role

Initial roles:

ADMIN
EXAM_COORDINATOR
INSTRUCTOR
PROCTOR
6. exams

Represents an examination.

CREATE TABLE exams (
    id UUID PRIMARY KEY,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255),
    exam_name VARCHAR(255) NOT NULL,
    term VARCHAR(50) NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
7. Exam Status

Allowed states:

DRAFT
CONFIGURED
READY
GENERATED
COMPLETED
ARCHIVED

The application must control valid transitions.

Example:

DRAFT
  ↓
CONFIGURED
  ↓
READY
  ↓
GENERATED
  ↓
COMPLETED
  ↓
ARCHIVED

Invalid transitions must be rejected.

8. students

Stores the minimum student information required by ExamFlow.

CREATE TABLE students (
    id UUID PRIMARY KEY,
    student_number VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

Important:

ExamFlow should not attempt to reproduce the complete university student profile.

Do not store unnecessary information such as:

Date of birth
Home address
Phone number
Personal email
Grades
Academic history

unless a future institutional requirement explicitly requires it.

9. exam_students

This table represents the relationship between a student and an examination.

CREATE TABLE exam_students (
    id UUID PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    UNIQUE (exam_id, student_id)
);

The unique constraint ensures:

One student
    +
One exam
    =
One exam enrollment record
10. rooms

Represents a physical examination room.

CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    building VARCHAR(100) NOT NULL,
    room_number VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    UNIQUE (building, room_number)
);

Example:

Building: Instructional Centre
Room: IA3010
Capacity: 120
11. seats

Represents a physical seat within a room.

CREATE TABLE seats (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    seat_code VARCHAR(50) NOT NULL,
    row_number INTEGER,
    column_number INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    UNIQUE (room_id, seat_code)
);

Example:

Room: IA3010


A01
A02
A03
A04
B01
B02
...
12. Seat Status

Initial values:

AVAILABLE
DISABLED
RESERVED

A disabled seat cannot be assigned.

13. exam_assignments

This is one of the most important tables in the entire system.

It represents:

Exam
+
Student
+
Room
+
Seat

Schema:

CREATE TABLE exam_assignments (
    id UUID PRIMARY KEY,


    exam_id UUID NOT NULL
        REFERENCES exams(id) ON DELETE CASCADE,


    exam_student_id UUID NOT NULL
        REFERENCES exam_students(id) ON DELETE CASCADE,


    seat_id UUID NOT NULL
        REFERENCES seats(id),


    assignment_method VARCHAR(50) NOT NULL,


    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    UNIQUE (exam_id, exam_student_id),
    UNIQUE (exam_id, seat_id)
);
14. Why exam_assignments Exists

Do not put:

room_id
seat_id

directly into students.

A student may participate in many exams.

For example:

Alice


MATH100 → IA3010 A07
CSC108  → IA3012 B03
PHY100  → IA3160 C12

Therefore seating belongs to the exam assignment, not the student.

15. Room Derivation

The assignment contains:

seat_id

and the seat belongs to:

room_id

Therefore:

exam_assignment
       ↓
seat
       ↓
room

We should avoid unnecessarily storing both:

room_id
seat_id

in exam_assignments.

Otherwise inconsistent data could occur:

room_id = IA3010
seat_id  = IA3012-B07

The room should be derived from the seat.

16. Assignment Method

Allowed values:

AUTOMATIC
RANDOM
MANUAL

Example:

Alice → IA3010 A07 → AUTOMATIC
Bob   → IA3010 B03 → RANDOM
Carol → IA3012 A02 → MANUAL
17. Random Assignment

When random seating is used, the system should record the random seed.

Add:

ALTER TABLE exams
ADD COLUMN assignment_seed VARCHAR(255);

This allows an assignment to be reproduced when required.

Example:

Exam:
MATH100-FINAL-2026


Seed:
2026-MATH100-FINAL
18. documents

Stores metadata about generated files.

Do not store large PDF binary data directly in PostgreSQL for the initial architecture.

CREATE TABLE documents (
    id UUID PRIMARY KEY,


    exam_id UUID NOT NULL
        REFERENCES exams(id) ON DELETE CASCADE,


    document_type VARCHAR(50) NOT NULL,


    version INTEGER NOT NULL,


    filename VARCHAR(500) NOT NULL,


    storage_key VARCHAR(1000) NOT NULL,


    file_size BIGINT,


    checksum VARCHAR(128),


    created_by UUID NOT NULL
        REFERENCES users(id),


    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
19. Document Types

Initial values:

ORIGINAL_TEMPLATE
PERSONALIZED_EXAM
SEATING_MAP
SIGNATURE_LIST
MANIFEST
EXAM_PACKAGE
20. Document Versioning

Generated documents must be versioned.

Example:

Exam Package v1

Student seating changes.

Then:

Exam Package v2

The previous version should remain available for audit purposes according to retention policy.

21. File Checksum

Generated documents should have a checksum.

Example:

SHA-256

This allows the system to determine whether a file has been changed or corrupted.

Example:

checksum:
a8c9f1...
22. audit_logs

Stores important administrative actions.

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,


    user_id UUID
        REFERENCES users(id),


    action VARCHAR(100) NOT NULL,


    entity_type VARCHAR(100) NOT NULL,


    entity_id UUID,


    old_values JSONB,


    new_values JSONB,


    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
23. Audit Examples

Example:

ACTION:
SEAT_ASSIGNMENT_CHANGED


ENTITY:
exam_assignment


OLD:
{
    "seat": "A07"
}


NEW:
{
    "seat": "B03"
}

Another:

ACTION:
EXAM_DOCUMENT_GENERATED
24. Sensitive Data Rule

Do not put unnecessary student information into audit logs.

Avoid:

{
  "student_name": "Alice Zhang",
  "student_number": "1001234567"
}

when the assignment ID is sufficient.

Prefer:

{
  "assignment_id": "uuid",
  "old_seat": "A07",
  "new_seat": "B03"
}
25. Crowdmark Metadata

The initial version should keep Crowdmark integration lightweight.

If Crowdmark-specific identifiers are required, they should be stored separately rather than spreading Crowdmark fields throughout the schema.

Future table:

crowdmark_assessments
crowdmark_booklets

These are not required for the initial MVP.

26. Why Crowdmark Should Not Be the Database

ExamFlow should not attempt to mirror the entire Crowdmark database.

Crowdmark remains external.

ExamFlow stores only the information required to perform its administrative functions.

This reduces:

Complexity
Synchronization problems
Duplicate data
Security exposure
Maintenance requirements
27. Database Constraints

The following rules are mandatory.

Rule 1

A student cannot be registered twice for the same exam.

UNIQUE (exam_id, student_id)
Rule 2

A seat cannot be assigned to two students in the same exam.

UNIQUE (exam_id, seat_id)
Rule 3

A seat belongs to exactly one room.

seats.room_id → rooms.id
Rule 4

A seat must be active before assignment.

This is enforced by application logic.

Rule 5

An exam cannot be marked READY if students remain unassigned.

Application validation must enforce this.

28. Important Business Rules

The database schema alone is not sufficient.

The application must enforce:

Exam must have:
    valid date
    valid duration
    valid template


Before READY:
    students imported
    rooms selected
    enough seats
    all students assigned
    no conflicts
29. Indexing Strategy

Indexes should be added for common queries.

Examples:

CREATE INDEX idx_exam_students_exam_id
ON exam_students(exam_id);


CREATE INDEX idx_exam_assignments_exam_id
ON exam_assignments(exam_id);


CREATE INDEX idx_exam_assignments_seat_id
ON exam_assignments(seat_id);


CREATE INDEX idx_documents_exam_id
ON documents(exam_id);


CREATE INDEX idx_audit_logs_entity
ON audit_logs(entity_type, entity_id);


CREATE INDEX idx_audit_logs_created_at
ON audit_logs(created_at);

Do not create indexes indiscriminately.

Add indexes based on actual query patterns.

30. UUID Policy

Use UUIDs for application-level entity identifiers.

Primary entities:

users
exams
students
rooms
seats
exam_students
exam_assignments
documents
audit_logs

Advantages:

Avoid predictable sequential IDs
Easier distributed integration later
Better external API identifiers
31. Timestamps

All timestamps should use:

TIMESTAMPTZ

and be stored in UTC.

The UI converts timestamps to the user's appropriate timezone.

Example:

Database:
2026-12-10T19:00:00Z


UI:
2026-12-10 14:00 EST
32. Deletion Policy

Hard deletion must be used carefully.

For historical examination data:

Archive

is preferred over immediate deletion.

For example:

Exam
  ↓
COMPLETED
  ↓
ARCHIVED

Permanent deletion should follow institutional retention policies.

33. Migration Strategy

Database schema changes must use Alembic migrations.

Example:

alembic revision
        ↓
migration file
        ↓
review
        ↓
test
        ↓
alembic upgrade

Never modify production database schemas manually without a corresponding migration.

34. SQLAlchemy Model Structure

Recommended:

backend/
└── app/
    └── models/
        ├── user.py
        ├── exam.py
        ├── student.py
        ├── exam_student.py
        ├── room.py
        ├── seat.py
        ├── exam_assignment.py
        ├── document.py
        └── audit_log.py

Models should represent database entities.

Business logic should remain primarily in services.

35. Database Transaction Rules

The following operations must be transactional:

Seating generation
Validate
 ↓
Create assignments
 ↓
Commit
Manual seat change
Validate
 ↓
Update assignment
 ↓
Create audit record
 ↓
Commit
Exam package generation metadata
Generate
 ↓
Store document metadata
 ↓
Commit

If a critical operation fails, changes must be rolled back.

36. Data Integrity Example

Suppose:

Exam:
MATH100


Student:
Alice


Seat:
IA3010-A07

The system creates:

exam_students

and:

exam_assignments

If another request attempts:

Bob → IA3010-A07

the database must reject the duplicate assignment.

The application should then return a friendly error:

Seat A07 is already assigned to another student.
37. Future Database Extensions

These tables may be introduced later if requirements justify them:

crowdmark_assessments
crowdmark_booklets
departments
courses
exam_accommodations
notifications
exam_sessions

They should not be added to v1 without an actual business requirement.

38. Database Anti-Patterns

AI developers must avoid:

Do not create one giant table

Bad:

exam_student_room_seat_document_user...
Do not duplicate room information

Avoid storing:

room_id
room_number
building

in every assignment.

Do not store PDFs in PostgreSQL initially

Use file/object storage.

Do not store complete student profiles

Only store required examination information.

Do not bypass database constraints

Application validation and database constraints should complement each other.

39. Initial ERD
┌──────────────┐
│    users     │
└──────┬───────┘
       │
       │ created_by
       ▼
┌──────────────┐
│    exams     │
└──────┬───────┘
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌──────────────┐       ┌──────────────┐
│ exam_students│       │  documents   │
└──────┬───────┘       └──────────────┘
       │
       ▼
┌──────────────┐
│   students   │
└──────────────┘




┌──────────────┐
│    rooms     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    seats     │
└──────┬───────┘
       │
       │
       ▼
┌──────────────────┐
│ exam_assignments │
└────────┬─────────┘
         │
         │
         ▼
   exam_students
40. AI Development Rules

AI coding agents must treat this document as the authoritative database design for v1.

Before creating a new table, the AI must ask:

Is this table required by an approved product requirement?

If the answer is no, do not create it.

Before adding a new field:

Is this field required by the current business workflow?

If not, do not add it.

Before changing an existing relationship:

Explain why.
Update DATABASE.md.
Create an Alembic migration.
Update tests.
Verify backward compatibility.
41. MVP Database Scope

The initial implementation should contain only:

users
exams
students
exam_students
rooms
seats
exam_assignments
documents
audit_logs

This is intentional.

The database should remain small until real operational requirements justify expansion.

42. Final Database Principle

Store only what ExamFlow needs to perform its job, and let Crowdmark and institutional systems remain responsible for the data they already own.

The database should support this core workflow:

Crowdmark Template
        +
Student Roster
        +
Rooms
        +
Seats
        ↓
     ExamFlow
        ↓
Exam Assignment
        ↓
Personalized Exams
        +
Seating Maps
        +
Signature Lists
        +
Audit Trail
