ExamFlow Architecture

Version: 1.0
Status: Proposed
Last Updated: 2026-08-19

1. Overview

ExamFlow is a lightweight, professional university-wide exam administration platform designed to work alongside Crowdmark.

ExamFlow does not replace Crowdmark.

Crowdmark remains the system of record for:

Exam assessments
Exam questions
Crowdmark QR codes
Student submissions
Scanning
Grading
Assessment results

ExamFlow focuses on the administrative work surrounding an exam:

Student roster import
Exam template import
Room and seat management
Student-to-seat assignment
Personalized exam document generation
Seating maps
Signature lists
Exam package generation
Audit logging

The primary architectural goal is:

Keep the system simple, reliable, secure, auditable, and easy to maintain.

2. Architecture Principles

ExamFlow follows these principles.

2.1 Keep Crowdmark as the Exam System of Record

ExamFlow must not duplicate Crowdmark's core exam functionality.

Crowdmark
    |
    | Exam content / QR / submission / grading
    |
    v
ExamFlow
    |
    | Seating / printing / administration

ExamFlow should complement Crowdmark rather than compete with it.

2.2 Prefer Simple Architecture

The initial system uses a modular monolithic architecture.

Browser
   |
   v
Next.js
   |
   v
FastAPI
   |
   v
PostgreSQL

Do not introduce microservices unless a demonstrated requirement exists.

2.3 Deterministic Business Logic

Important examination decisions must be deterministic and testable.

Examples:

Seat assignment
Duplicate-seat detection
Capacity validation
Exam status transitions
Document generation

AI/LLM must not make authoritative examination decisions.

2.4 Security by Design

Student information is sensitive institutional data.

Security must be considered from the beginning rather than added later.

2.5 Auditability

Any important administrative action must be traceable.

The system should be able to answer:

Who changed this assignment, when, and what was the previous value?

2.6 Preserve Original Exam Documents

Uploaded Crowdmark exam templates must never be modified in place.

The original document is immutable.

Generated documents are separate artifacts.

3. High-Level Architecture
                         ┌─────────────────────┐
                         │       Users         │
                         │                     │
                         │ Registrar            │
                         │ Exam Coordinator    │
                         │ Instructor           │
                         │ Proctor              │
                         └──────────┬──────────┘
                                    │
                                  HTTPS
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      Next.js        │
                         │     Web Portal      │
                         │                     │
                         │ React + TypeScript  │
                         └──────────┬──────────┘
                                    │
                               REST / JSON
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       FastAPI       │
                         │   Application API   │
                         │                     │
                         │ Authentication      │
                         │ Authorization       │
                         │ Exam Management     │
                         │ Roster Management   │
                         │ Room/Seat Management│
                         │ Assignment Engine   │
                         │ PDF Generation      │
                         │ Audit Logging       │
                         └──────────┬──────────┘
                                    │
                          SQLAlchemy / PostgreSQL
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     PostgreSQL      │
                         │                     │
                         │ Exams               │
                         │ Students            │
                         │ Rooms               │
                         │ Seats               │
                         │ Assignments         │
                         │ Documents           │
                         │ Audit Logs          │
                         └─────────────────────┘


                                    │
                                    │ File Storage
                                    ▼
                         ┌─────────────────────┐
                         │   Document Storage  │
                         │                     │
                         │ Original PDFs       │
                         │ Generated PDFs      │
                         │ Exam Packages       │
                         └─────────────────────┘


                                    │
                                    │ Import / Export
                                    ▼
                         ┌─────────────────────┐
                         │     Crowdmark       │
                         └─────────────────────┘
4. Application Architecture

ExamFlow is a modular monolith.

The backend is one FastAPI application, but internally it is divided into clear domains.

backend/
│
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── auth.py
│   │   ├── exams.py
│   │   ├── students.py
│   │   ├── rooms.py
│   │   ├── seats.py
│   │   ├── assignments.py
│   │   ├── documents.py
│   │   └── audit.py
│   │
│   ├── models/
│   │   ├── exam.py
│   │   ├── student.py
│   │   ├── room.py
│   │   ├── seat.py
│   │   ├── assignment.py
│   │   └── audit.py
│   │
│   ├── schemas/
│   │
│   ├── services/
│   │   ├── exam_service.py
│   │   ├── roster_service.py
│   │   ├── seating_service.py
│   │   ├── pdf_service.py
│   │   ├── package_service.py
│   │   └── audit_service.py
│   │
│   ├── repositories/
│   │
│   ├── security/
│   │
│   └── config.py
│
├── migrations/
│
└── tests/

The purpose of this structure is separation of responsibility, not creation of microservices.

5. Frontend Architecture

The frontend uses:

Next.js
React
TypeScript
Tailwind CSS
shadcn/ui

The frontend is responsible for:

User interface
Form handling
Data display
User workflow
Client-side validation
API communication

The frontend must not contain authoritative business rules.

For example, the frontend may display:

185 students
200 seats

but the backend must independently verify that the assignment is valid.

6. Backend Architecture

FastAPI is the primary application backend.

The backend is responsible for:

Business rules
Database operations
Authentication
Authorization
Validation
Seat assignment
Document generation
Audit logging

The backend is the authoritative application layer.

7. API Layer

The API follows REST-style conventions.

Example:

GET    /api/exams
POST   /api/exams
GET    /api/exams/{id}
PATCH  /api/exams/{id}
DELETE /api/exams/{id}

Students:

GET    /api/exams/{id}/students
POST   /api/exams/{id}/students/import

Rooms:

GET    /api/rooms
POST   /api/rooms
PATCH  /api/rooms/{id}

Assignments:

POST   /api/exams/{id}/assignments/generate
GET    /api/exams/{id}/assignments
PATCH  /api/assignments/{id}

Documents:

POST   /api/exams/{id}/documents/generate
GET    /api/exams/{id}/documents
8. Database Architecture

PostgreSQL is the authoritative data store.

Core entities:

User
Exam
Student
ExamStudent
Room
Seat
ExamAssignment
Document
AuditLog

Relationship:

Exam
 │
 ├── ExamStudent ─── Student
 │
 ├── Room
 │     │
 │     └── Seat
 │
 └── ExamAssignment
         │
         ├── Student
         ├── Room
         └── Seat

Database constraints must enforce critical business rules.

Examples:

UNIQUE (exam_id, student_id)

and:

UNIQUE (exam_id, seat_id)

This ensures that a student cannot be assigned twice to the same exam and that a seat cannot be assigned to two students in the same exam.

9. Exam Lifecycle

An exam follows a controlled lifecycle.

Draft
  │
  ▼
Configured
  │
  ▼
Ready
  │
  ▼
Generated
  │
  ▼
Completed
  │
  ▼
Archived
Draft

Exam has been created but is incomplete.

Configured

Exam template, roster, rooms, and seats have been configured.

Ready

All validation checks have passed.

Generated

Exam documents have been generated.

Completed

The examination has taken place.

Archived

The exam is retained for historical/audit purposes.

10. Exam Import Workflow

Exam templates originate from Crowdmark.

Crowdmark
    │
    │ Export PDF
    ▼
ExamFlow
    │
    ▼
Validate PDF
    │
    ▼
Store Original Template

The original PDF is immutable.

Example:

storage/
└── exams/
    └── 2026/
        └── MATH100-FINAL/
            ├── original/
            │   └── crowdmark-template.pdf
            │
            └── generated/
11. Student Roster Workflow

v1 supports CSV import.

CSV
 │
 ▼
Parser
 │
 ▼
Validation
 │
 ├── Duplicate ID
 ├── Missing ID
 ├── Missing Name
 └── Invalid format
 │
 ▼
PostgreSQL

The imported roster is associated with a specific exam.

ExamFlow does not attempt to maintain the university's complete student information system.

12. Room and Seat Architecture

Rooms are centrally managed resources.

Room
 │
 ├── Building
 ├── Room Number
 ├── Capacity
 │
 └── Seats
       ├── A01
       ├── A02
       ├── A03
       └── ...

Seat configuration should normally be managed by administrators rather than recreated for every exam.

13. Seating Assignment Engine

The seating engine is deterministic.

Input:

Students
Rooms
Seats
Constraints
Random Seed

Output:

Student → Room → Seat

Example:

Alice → IA3010 → A07
Bob   → IA3010 → B03
Carol → IA3012 → C05

The engine must validate:

No duplicate student assignment
No duplicate seat assignment
No unavailable seats
No capacity violation
No invalid room
14. Manual Seating Changes

Automatic assignment is not immutable.

Authorized users can manually change assignments.

Example:

A07 → B03

The system must:

Validate the new seat.
Update the assignment.
Record an audit event.
Mark affected documents as requiring regeneration.

Example:

Assignment changed


Student: [internal assignment reference]
Old Seat: IA3010 A07
New Seat: IA3010 B03
Changed By: user
Changed At: timestamp
15. PDF Generation Architecture

PDF generation is handled by a dedicated service.

Original Crowdmark PDF
          +
Student Information
          +
Room
          +
Seat
          │
          ▼
     PDF Overlay
          │
          ▼
Personalized PDF

The original Crowdmark document must remain unchanged.

The PDF generation service must preserve:

Original pages
Original page order
Crowdmark QR codes
Crowdmark booklet identifiers
Existing exam content

ExamFlow only adds approved administrative information.

16. Crowdmark QR Code Rule

This is a critical architectural rule.

ExamFlow must not generate, replace, move, or modify Crowdmark QR codes.

ExamFlow assumes the QR code belongs to Crowdmark.

The PDF overlay must be tested to ensure that the QR code remains readable after processing and printing.

17. Document Generation

ExamFlow generates three primary document types.

Personalized Exam
Exam content
+
Student information
+
Room
+
Seat
Seating Map
Room
+
Seat layout
+
Student assignment
Signature List
Seat
+
Student ID
+
Student name
+
Signature field
18. Exam Package Architecture

A completed exam generates an immutable package version.

Example:

Exam Package v1
    │
    ├── Exam PDFs
    ├── Seating Maps
    ├── Signature Lists
    └── Manifest

If seating changes:

Exam Package v1
        ↓
Assignment changed
        ↓
Exam Package v2

Previous versions should remain auditable.

19. File Storage

Large PDF files should not be stored directly inside PostgreSQL.

PostgreSQL stores metadata:

Document
├── id
├── exam_id
├── document_type
├── version
├── filename
├── storage_key
├── created_at
└── created_by

The actual file is stored in file/object storage.

v1 may use local filesystem storage.

Future deployments may use:

S3
Azure Blob Storage
institutional object storage

The application should access storage through an abstraction rather than hardcoding filesystem paths throughout the application.

20. Authentication

Authentication should use university identity services.

Preferred:

University SSO
      │
      ▼
OIDC / OAuth 2.0
      │
      ▼
ExamFlow

ExamFlow should not maintain university passwords.

21. Authorization

RBAC is enforced by the backend.

Example:

Admin
 ├── Users
 ├── Rooms
 ├── Seats
 └── System configuration


Exam Coordinator
 ├── Exams
 ├── Students
 ├── Seating
 └── Documents


Instructor
 ├── View Exams
 ├── View Seating
 └── Download Documents


Proctor
 ├── View Seating
 └── View Signature Lists

Frontend hiding a button is not considered authorization.

The backend must enforce permissions.

22. Audit Architecture

Important changes generate audit events.

User Action
    │
    ▼
Business Service
    │
    ├── Database Change
    │
    └── Audit Event

Audit records should include:

timestamp
user_id
action
entity_type
entity_id
old_value
new_value

Sensitive student data should not unnecessarily appear in audit logs.

23. Security Architecture

Security requirements include:

HTTPS
SSO
RBAC
Input validation
SQL injection protection
CSRF protection where applicable
Secure file upload validation
File access authorization
Audit logging
Secure session handling
No student information in application logs
Secure configuration/secrets management

Uploaded PDFs must be treated as untrusted files.

24. Validation Architecture

Validation occurs at multiple layers.

Browser
   ↓
API Schema Validation
   ↓
Business Logic Validation
   ↓
Database Constraints

No single layer should be trusted to enforce all rules.

Example:

Frontend:
"185 students"


Backend:
"185 valid students"


Database:
"student/exam relationship is unique"
25. Transaction Management

Operations that modify multiple related records must use database transactions.

For example, seating generation:

Begin Transaction
      │
      ├── Validate students
      ├── Validate seats
      ├── Create assignments
      ├── Record audit information
      │
      ▼
Commit

If any critical step fails:

Rollback

No partial seating assignment should remain.

26. Background Processing

The first version should avoid unnecessary job infrastructure.

For small exams, synchronous processing may be sufficient.

For larger document generation tasks:

Generate Exam Package
        │
        ▼
Background Job
        │
        ▼
Progress
        │
        ▼
Completed

A background worker can be introduced if actual performance testing demonstrates the need.

Do not add Celery/Redis simply because they are common technologies.

27. API and Domain Separation

Business logic must not be placed directly inside API route handlers.

Bad:

@app.post("/assign")
def assign():
    # 200 lines of business logic

Preferred:

API
 ↓
Service
 ↓
Repository
 ↓
Database

Example:

assignments.py
      ↓
seating_service.py
      ↓
assignment_repository.py
      ↓
PostgreSQL

This makes the system easier to test and maintain.

28. Testing Architecture

Testing is required at multiple levels.

Unit Tests

Test:

Seating algorithm
Validation
Exam state transitions
CSV parsing
PDF metadata handling
Integration Tests

Test:

API
 ↓
Database
End-to-End Tests

Test:

Create Exam
 ↓
Import Students
 ↓
Select Room
 ↓
Assign Seats
 ↓
Generate Documents
PDF Integration Tests

Use real Crowdmark-exported test PDFs to verify:

QR preservation
Page count
Page order
Overlay placement
Generated text
PDF readability
29. Crowdmark Integration Strategy
v1

Use file-based integration:

Crowdmark
    ↓
Export
    ↓
ExamFlow
    ↓
Generate
    ↓
Print

No direct API dependency.

v2

If institutional access and requirements justify it:

ExamFlow
     ↕
Crowdmark API

Potential capabilities:

Import assessments
Import rosters
Retrieve booklet information
Synchronize metadata

Crowdmark API integration must remain isolated in a dedicated integration module.

backend/
└── integrations/
    └── crowdmark/

No Crowdmark-specific code should be scattered throughout the application.

30. Deployment Architecture

Initial deployment:

Internet / University Network
             │
             ▼
          Apache
             │
             │ HTTPS
             ▼
        Next.js Server
             │
             ▼
        FastAPI Server
             │
             ▼
        PostgreSQL
             │
             ▼
       File Storage

Apache is responsible for:

TLS termination
Reverse proxy
HTTP security headers
Static routing where appropriate
31. Environment Separation

At minimum:

Development
Testing
Production

Production must have:

Separate database
Separate storage
Separate secrets
Restricted access
Backup policy

Never use production student data for development or testing.

32. Configuration Management

Configuration comes from environment variables or secure configuration management.

Examples:

DATABASE_URL
STORAGE_PATH
OIDC_ISSUER
OIDC_CLIENT_ID
OIDC_CLIENT_SECRET
CROWDMark_API_URL

Secrets must never be committed to Git.

33. Backup Strategy

The system should have backups for:

PostgreSQL

Regular automated backups.

Documents

Backup original Crowdmark templates and generated exam packages according to institutional retention requirements.

Configuration

Infrastructure configuration should be version-controlled where appropriate.

34. Observability

The system should provide:

Application Logs
Error Logs
Audit Logs
Health Check

Health endpoint:

GET /health

Example:

{
  "status": "healthy"
}

Logs must not contain unnecessary student personal information.

35. Scalability

ExamFlow should initially be designed for:

500+ students per exam
20+ rooms per exam
10,000+ seats
multiple concurrent exams

The architecture should scale vertically before introducing distributed architecture.

The preferred scaling strategy is:

Bigger server
      ↓
Database optimization
      ↓
Background processing
      ↓
Horizontal scaling if actually required

Do not prematurely introduce Kubernetes or microservices.

36. AI Policy

AI is not part of the core architecture.

The system must not depend on:

LLMs
AI training
RAG
Vector databases
AI-generated seating decisions

If an AI assistant is introduced in the future, it must operate through controlled APIs and must never directly make authoritative examination decisions.

Example future architecture:

User
 ↓
AI Assistant
 ↓
Structured Command
 ↓
ExamFlow API
 ↓
Validation
 ↓
Database

The AI must never bypass normal authorization and validation.

37. Future Extension Points

The architecture should allow future additions without requiring a major rewrite.

Potential future integrations:

Crowdmark API
University SIS
University SSO
Institutional Storage
Email / Notification
Accessibility systems

These should be implemented as isolated integrations.

backend/
└── integrations/
    ├── crowdmark/
    ├── sis/
    ├── sso/
    └── storage/
38. Architecture Decision Rules for AI Coding Agents

AI coding agents must follow these rules.

Rule 1

Do not introduce new architecture without justification.

Rule 2

Do not introduce microservices.

Rule 3

Do not introduce AI/ML.

Rule 4

Do not duplicate Crowdmark functionality.

Rule 5

Do not modify unrelated modules.

Rule 6

Do not change database schema without:

Migration
Documentation update
Tests
Rule 7

Do not place business logic inside frontend components.

Rule 8

Do not place large business logic directly inside API routes.

Rule 9

All critical business rules must be enforced server-side.

Rule 10

Every significant feature must include tests.

Rule 11

Student personal information must not be exposed in logs.

Rule 12

Prefer boring, well-understood technologies over unnecessary complexity.

39. Technology Stack
Layer	Technology
Web	Next.js
UI	React
Language	TypeScript
CSS	Tailwind CSS
Components	shadcn/ui
API	FastAPI
Language	Python
Validation	Pydantic
ORM	SQLAlchemy
Migration	Alembic
Database	PostgreSQL
PDF	PyMuPDF / ReportLab
CSV	Python standard library / pandas where appropriate
Authentication	University SSO / OIDC
Web Server	Apache
Deployment	Linux
Version Control	Git / GitHub
40. Architecture Summary

ExamFlow uses a modular monolithic architecture:

                     ExamFlow
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
   Next.js            FastAPI          PostgreSQL
       │                 │
       │        ┌────────┼────────┐
       │        │        │        │
       │        ▼        ▼        ▼
       │     Seating    PDF     Audit
       │     Engine    Engine   Service
       │
       └───────────────┬───────────────────
                       │
                       ▼
                  File Storage
                       │
                       ▼
                   Crowdmark

The architecture deliberately favors:

simplicity → reliability → security → auditability → maintainability

over unnecessary technical complexity.

41. Final Architectural Principle

ExamFlow should be a small system that does a small number of things extremely well.

The system should make examination administration easier without becoming another large university information system.

The architectural boundary is:

┌─────────────────────────────────────────┐
│              CROWDMARK                  │
│                                         │
│ Exam content                            │
│ QR codes                                │
│ Submission                              │
│ Scanning                                │
│ Grading                                 │
└──────────────────┬──────────────────────┘
                   │
                   │ Import / Export
                   │
┌──────────────────▼──────────────────────┐
│               EXAMFLOW                  │
│                                         │
│ Student roster                          │
│ Rooms                                   │
│ Seats                                   │
│ Seating assignment                      │
│ Personalized printing                  │
│ Seating maps                            │
│ Signature lists                         │
│ Exam packages                           │
│ Audit                                   │
└─────────────────────────────────────────┘

That boundary should be treated as a core architectural constraint, not merely a current implementation choice.
