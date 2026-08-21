ExamFlow Security

File: SECURITY.md
Version: 1.0
Status: Proposed
Last Updated: 2026-08-19

1. Purpose

This document defines the security requirements and security architecture for ExamFlow.

ExamFlow handles university examination administration information, including:

Student names
Student numbers
Exam registrations
Exam room assignments
Exam seat assignments
Exam documents
Seating maps
Signature lists
Administrative audit information

Because this information is associated with students and examinations, security and privacy must be treated as core system requirements.

The system must follow the principle:

Users should have access only to the examination information required for their role and responsibilities.

2. Security Objectives

ExamFlow security is based on five primary objectives:

Confidentiality
       +
Integrity
       +
Availability
       +
Accountability
       +
Least Privilege
Confidentiality

Unauthorized users must not access student or examination information.

Integrity

Unauthorized users must not modify:

Student assignments
Seats
Exam documents
Exam configurations
Availability

Authorized users must be able to access the system during examination preparation and administration.

Accountability

Important administrative actions must be recorded.

Least Privilege

Users receive only the permissions required for their role.

3. Security Boundary

ExamFlow is not the university's identity system, student information system, or assessment system.

The system boundary is:

┌─────────────────────────────────────────────┐
│              University Systems             │
│                                             │
│  Identity / SSO                             │
│  Student Information System                 │
│  Crowdmark                                  │
└───────────────┬─────────────────────────────┘
                │
                │ Controlled Integration
                ▼
┌─────────────────────────────────────────────┐
│                  ExamFlow                   │
│                                             │
│  Exam Administration                        │
│  Seating                                    │
│  Printing                                   │
│  Documents                                  │
│  Audit                                      │
└─────────────────────────────────────────────┘

ExamFlow must not attempt to become a replacement for university identity, registration, or assessment systems.

4. Threat Model

The system should consider at least the following threats.

4.1 Unauthorized User Access

An unauthorized person obtains access to ExamFlow.

Examples:

Stolen credentials
Compromised session
Shared account
Incorrect permissions

Mitigation:

University SSO
MFA through institutional identity infrastructure
RBAC
Session expiration
Audit logging
5. Unauthorized Student Information Access

A user who should only see seating information should not automatically receive administrative information for all exams.

Example:

A proctor should not necessarily be able to:

Create exams
Import student rosters
Modify assignments
Download all exam PDFs

Permissions must be explicitly defined.

6. Unauthorized Exam Document Access

Exam PDFs are highly sensitive.

A generated exam may contain:

Exam questions
Student name
Student number
Room
Seat
Crowdmark information

Therefore exam documents must never be publicly accessible.

Do not expose PDFs using:

/static/exams/

or another unauthenticated public directory.

7. Authentication

ExamFlow should use university-provided authentication.

Preferred architecture:

User
 │
 ▼
University SSO
 │
 │ OIDC / OAuth 2.0
 ▼
ExamFlow

ExamFlow must not maintain university passwords.

8. Multi-Factor Authentication

MFA should be provided by the University's identity provider.

ExamFlow should not implement its own MFA system unless specifically required by institutional security policy.

For example:

User
 ↓
University SSO
 ↓
Duo / Institutional MFA
 ↓
ExamFlow

The exact MFA provider is an institutional deployment decision.

9. Authentication Requirements

The application must:

Validate identity tokens
Validate token issuer
Validate token audience
Validate token expiration
Validate required claims
Establish an application session securely
Reject invalid or expired tokens

The backend must never trust identity information supplied directly by the browser.

Bad:

{
  "user_id": "admin"
}

The backend must derive identity from the authenticated session/token.

10. Authorization

Authentication answers:

Who are you?

Authorization answers:

What are you allowed to do?

ExamFlow must enforce authorization on the backend.

Hiding UI buttons is not authorization.

11. Role-Based Access Control

Initial roles:

ADMIN
EXAM_COORDINATOR
INSTRUCTOR
PROCTOR

Recommended permission model:

Function	Admin	Coordinator	Instructor	Proctor
View exams	Yes	Yes	Yes	Assigned only
Create exam	Yes	Yes	No	No
Edit exam	Yes	Yes	Limited	No
Import roster	Yes	Yes	No	No
Manage rooms	Yes	Yes	No	No
Manage seats	Yes	Yes	No	No
Generate assignments	Yes	Yes	No	No
Modify assignments	Yes	Yes	Limited	No
Generate documents	Yes	Yes	Limited	No
View seating map	Yes	Yes	Yes	Assigned only
View signature list	Yes	Yes	Yes	Assigned only
Download exam PDFs	Yes	Yes	Controlled	No
Manage users	Yes	No	No	No
View audit logs	Yes	Yes	Limited	No

Actual permissions should be reviewed with Registrar/IITS before production deployment.

12. Least Privilege

Every endpoint must explicitly determine whether the current user is authorized.

Example:

GET /api/exams/123

must verify that the user is allowed to view exam 123.

Do not assume that knowing the UUID is sufficient authorization.

13. IDOR Protection

ExamFlow must prevent insecure direct object references.

For example:

/api/exams/abc
/api/exams/def
/api/exams/ghi

A user must not gain access simply by changing:

abc → def

The backend must check:

User
 +
Role
 +
Exam ownership/assignment
 =
Authorization
14. Student Privacy

ExamFlow should follow data minimization.

Only store information required for examination administration.

Required:

Student Number
Student Name

Potentially required:

Exam enrollment
Room
Seat

Do not store unnecessary student information.

Examples of information that should not be stored by default:

Date of birth
Home address
Personal phone number
Personal email
Grades
Academic history
Financial information
15. Student Number Protection

Student numbers are sensitive institutional information.

They should not appear unnecessarily in:

Application logs
Debug messages
Error messages
URLs
Browser analytics
Monitoring systems

Where possible, internal logs should reference:

student UUID

rather than:

student number
16. Logging Policy

Logs must be useful without exposing sensitive information.

Bad:

Student 1001234567 Alice Zhang assigned to IA3010 A07

Preferred:

Exam assignment created
exam_id=...
assignment_id=...

Operational logs should contain identifiers necessary for troubleshooting, but not unnecessary student PII.

17. Audit Logging

Security-sensitive actions must generate audit records.

Examples:

LOGIN
LOGOUT


EXAM_CREATED
EXAM_UPDATED
EXAM_DELETED


ROSTER_IMPORTED
ROSTER_UPDATED


ROOM_CREATED
ROOM_UPDATED


SEAT_CREATED
SEAT_UPDATED


ASSIGNMENT_GENERATED
ASSIGNMENT_CHANGED


DOCUMENT_GENERATED
DOCUMENT_DOWNLOADED


PERMISSION_CHANGED
18. Audit Log Requirements

Each audit event should contain:

timestamp
user_id
action
entity_type
entity_id
old_value
new_value
request_id

Example:

{
  "action": "ASSIGNMENT_CHANGED",
  "entity_type": "exam_assignment",
  "entity_id": "uuid",
  "old_value": {
    "seat": "A07"
  },
  "new_value": {
    "seat": "B03"
  }
}
19. Audit Logs Must Be Tamper Resistant

Normal users must not be able to modify or delete audit logs.

The application should not expose a normal API such as:

DELETE /api/audit-logs/{id}

Audit records should be append-oriented.

Administrative access should be tightly restricted.

20. Session Security

Sessions must use secure mechanisms.

Requirements:

Secure cookies where cookie-based sessions are used
HttpOnly cookies
SameSite protection
Session expiration
Server-side authorization checks
Logout support
Protection against session fixation

Do not store long-lived authentication tokens in browser localStorage unless explicitly justified and reviewed.

21. HTTPS

Production ExamFlow must use HTTPS.

Browser
   │
   │ HTTPS
   ▼
Apache
   │
   ▼
Next.js
   │
   ▼
FastAPI

HTTP should redirect to HTTPS where appropriate.

22. HTTP Security Headers

Production should use appropriate security headers.

At minimum consider:

Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy

The exact Content Security Policy should be tested with the Next.js application before enforcement.

Do not blindly copy a generic CSP from the Internet.

23. Cross-Origin Resource Sharing

CORS must be restrictive.

Do not use:

Access-Control-Allow-Origin: *

for authenticated production APIs.

Instead configure explicit trusted origins.

Example:

https://examflow.example.utoronto.ca
24. CSRF Protection

If authentication uses cookie-based sessions, CSRF protection must be enabled for state-changing requests.

Protected methods include:

POST
PUT
PATCH
DELETE

The implementation must follow the selected authentication/session architecture.

25. Input Validation

All user input must be validated.

Examples:

CSV files
Exam names
Course codes
Room numbers
Seat codes
Student numbers
File uploads
API parameters

Use Pydantic models for FastAPI request validation.

Example:

class CreateExamRequest(BaseModel):
    course_code: str
    exam_name: str
    exam_date: date
    duration_minutes: int
26. SQL Injection Protection

Never construct SQL using string concatenation.

Bad:

query = f"SELECT * FROM students WHERE id = '{student_id}'"

Use SQLAlchemy parameterized queries.

27. File Upload Security

ExamFlow accepts PDF and CSV files.

Uploaded files must be treated as untrusted.

The system must validate:

File extension
MIME type
File size
File structure
File contents where appropriate

Do not trust:

filename.pdf

alone.

28. PDF Security

PDF files should be processed in a controlled environment.

The application must:

Validate PDFs
Apply reasonable file size limits
Avoid executing embedded content
Store uploaded files outside executable directories
Generate output using trusted libraries
Preserve original files

PDF processing should not allow arbitrary code execution.

29. CSV Security

CSV imports must be validated.

Potential problems include:

Malformed CSV
Duplicate students
Missing columns
Invalid student numbers
Formula injection

Spreadsheet formula injection should be considered if exported CSV files may subsequently be opened in Excel or similar applications.

30. QR Code Security

Crowdmark QR codes are critical to the exam workflow.

ExamFlow must:

Preserve original Crowdmark QR codes
Never replace them
Never expose QR information unnecessarily
Validate generated PDFs

ExamFlow must not attempt to invent or modify Crowdmark QR codes.

31. Document Authorization

Document downloads must always be authorized.

Bad:

GET /files/exam-123.pdf

where anyone who knows the filename can download it.

Preferred:

GET /api/documents/{document_id}/download

Backend verifies:

Authenticated user
        +
Role
        +
Exam access
        +
Document permission

Only then is the file returned.

32. Temporary Download URLs

If object storage is used in the future, temporary signed URLs may be used.

Example:

User
 ↓
ExamFlow authorization
 ↓
Short-lived signed URL
 ↓
Object storage

The URL should have a short expiration period.

33. Exam Document Protection

Generated exam documents are among the most sensitive assets in the system.

Access should be limited to authorized personnel.

A proctor who only needs a seating map should not automatically receive the personalized exam PDFs.

34. Separation of Documents

The system should distinguish:

PERSONALIZED_EXAM
SEATING_MAP
SIGNATURE_LIST

Different roles may receive different document types.

Example:

Instructor
    ↓
Exam + Seating Map


Proctor
    ↓
Seating Map + Signature List

Actual institutional policy determines the final permission model.

35. Data Encryption
In Transit

All production communication must use HTTPS/TLS.

At Rest

Encryption at rest should be provided by the underlying infrastructure where possible:

PostgreSQL disk encryption
Server disk encryption
Object storage encryption
Backup encryption

ExamFlow should not invent its own database encryption scheme.

36. Secrets Management

Secrets must never be committed to Git.

Examples:

DATABASE_URL
OIDC_CLIENT_SECRET
CROWDMark_API_KEY
STORAGE_ACCESS_KEY

Use:

Environment variables

or institutional secret-management infrastructure.

Never:

.env

inside the Git repository.

Use:

.env.example

containing placeholders.

37. Example .env.example
DATABASE_URL=


OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=


STORAGE_TYPE=
STORAGE_PATH=


CROWDMARK_API_URL=
CROWDMARK_API_KEY=

No real credentials should appear in this file.

38. Database Security

The application database account should follow least privilege.

The application should not normally connect as:

postgres

Instead use a dedicated database account.

Example:

examflow_app

with only required permissions.

39. Database Network Security

PostgreSQL should not be exposed directly to the public Internet unless there is a specific, reviewed requirement.

Preferred:

Internet
   │
   ▼
Apache
   │
   ▼
Application
   │
   ▼
Private PostgreSQL
40. Database Backups

Backups must be:

Automated
Encrypted
Access controlled
Tested

A backup is not considered reliable until restoration has been tested.

Recommended:

Database
   ↓
Automated Backup
   ↓
Protected Storage
   ↓
Periodic Restore Test
41. Document Backups

Important exam documents should be backed up according to institutional retention requirements.

This includes:

Original Crowdmark templates
Generated exam packages
Seating maps
Signature lists

Backups must have access controls equivalent to production data.

42. Development Environment

Production student information must not be copied into developer laptops or development environments unless explicitly authorized by institutional policy.

Development should use synthetic data.

Example:

Alice Student
100000001

rather than real student information.

43. Test Data

Automated tests must use synthetic students.

Example:

Student 001
Student 002
Student 003

No real student records should be embedded in the Git repository.

44. Production Data Access

Developers should not have unrestricted access to production student information.

Access should follow institutional authorization and least privilege.

If production troubleshooting is required:

Use temporary access
Record the access
Minimize data exposure
Remove access afterward
45. Error Handling

Errors returned to users must not expose:

SQL statements
Stack traces
File system paths
Environment variables
Database credentials
Internal service information

Bad:

psycopg2.errors.UniqueViolation:
DETAIL: Key (student_id)=(...) already exists...

User-facing response:

This student is already registered for this exam.

Detailed technical information should remain in secured server logs.

46. Rate Limiting

Authentication and sensitive endpoints should have rate limiting.

Examples:

/login
/api/auth/*
/api/documents/*/download
/api/students/import

The exact limits should be determined through testing and institutional requirements.

47. Brute Force Protection

If ExamFlow relies on university SSO, authentication brute-force protection should primarily be handled by the institutional identity provider.

ExamFlow should still protect application endpoints against abuse.

48. Dependency Security

Dependencies must be kept reasonably current.

For Python:

requirements / pyproject

For Node:

package.json
pnpm-lock.yaml

Security updates should be reviewed regularly.

Do not blindly upgrade major versions in production.

49. Dependency Scanning

The project should use automated dependency scanning where available.

For example:

GitHub Dependabot
GitHub CodeQL
npm/pnpm audit
pip dependency scanning

The exact tools can be selected during CI implementation.

50. CI/CD Security

CI/CD pipelines must not expose secrets.

Secrets should be stored in:

GitHub Actions Secrets

or institutional secret management.

Do not put credentials in:

GitHub workflow YAML
51. Git Security

The repository must never contain:

.env
database passwords
API keys
private keys
SSO secrets
production credentials
real student data
production PDFs

Recommended .gitignore:

.env
.env.*
!.env.example


*.pem
*.key


storage/
uploads/
generated/


*.pdf


__pycache__/
node_modules/
.next/
52. Security Testing

Security testing should be included before production deployment.

At minimum:

Authentication

Test:

Invalid token
Expired token
Missing token
Authorization

Test:

Student access
Instructor access
Proctor access
Admin access
Object access

Test:

User A
    ↓
Exam A


Attempt Exam B
    ↓
403 Forbidden
File access

Test unauthorized document downloads.

53. OWASP Security Principles

ExamFlow development should follow the principles of the OWASP Top 10.

Particular attention should be given to:

Broken access control
Cryptographic failures
Injection
Security misconfiguration
Vulnerable components
Authentication failures
Logging failures

OWASP should be treated as a baseline, not the complete institutional security policy.

54. Security Headers and Browser Protection

The production frontend should implement:

HTTPS
CSP
HSTS
X-Content-Type-Options
Referrer-Policy

Browser security policies should be tested before deployment.

55. File Storage Permissions

The server filesystem containing exam documents must not be publicly readable.

Example:

/var/lib/examflow/

should be readable only by the ExamFlow application service account and authorized administrators.

Do not use:

/var/www/html/exams/

for sensitive exam files.

56. Service Account

ExamFlow should run under a dedicated Linux account.

Example:

examflow

The service account should not have:

sudo
root

privileges.

57. Linux Deployment Security

Production server should follow standard institutional Linux hardening practices.

At minimum:

Security updates
Firewall
SSH key authentication
Restricted SSH access
No unnecessary services
Dedicated application user
File permission controls
Centralized monitoring
Log rotation
58. Monitoring

Security-related events should be monitored.

Examples:

Repeated authentication failures
Unusual document downloads
Large roster imports
Repeated authorization failures
Unexpected application errors

Monitoring systems should avoid collecting unnecessary student information.

59. Incident Response

If a security incident is suspected:

Detect
 ↓
Contain
 ↓
Preserve evidence
 ↓
Assess impact
 ↓
Notify appropriate institutional security/privacy personnel
 ↓
Remediate
 ↓
Review

ExamFlow administrators must follow the University's established incident response process.

ExamFlow must not invent an independent institutional incident response policy.

60. Privacy and Institutional Policy

ExamFlow must comply with applicable University policies and institutional requirements concerning:

Privacy
Student records
Information security
Data retention
Access control
Records management

Before production deployment, the security and privacy requirements should be reviewed with the appropriate University/IITS/Registrar stakeholders.

61. Data Retention

Exam data should not be retained indefinitely simply because storage is inexpensive.

Retention should be defined based on institutional requirements.

Possible categories:

Active Exams
     ↓
Completed Exams
     ↓
Archived Exams
     ↓
Retention Period
     ↓
Secure Disposal

Retention periods must be configurable or documented rather than hardcoded into application logic.

62. Secure Disposal

When records reach the end of their approved retention period, disposal must follow institutional policy.

This may include:

Database records
PDFs
Backups
Temporary files

Deleting a database row alone may not be sufficient if copies exist elsewhere.

63. Security vs Convenience

ExamFlow should prefer security when there is a conflict between convenience and protection of examination material.

For example:

Bad:

"Anyone with the URL can download the exam."

Preferred:

"The user must authenticate and be authorized to access the exam."

64. Security Rules for AI Coding Agents

AI coding agents must follow these rules.

Rule 1

Never add authentication bypasses for development convenience.

Rule 2

Never disable authorization checks.

Rule 3

Never log student names or student numbers unnecessarily.

Rule 4

Never commit secrets.

Rule 5

Never use real student data in tests.

Rule 6

Never expose exam PDFs through a public directory.

Rule 7

Never trust client-side authorization.

Rule 8

Never construct SQL using string concatenation.

Rule 9

Never modify Crowdmark QR codes.

Rule 10

Never add a dependency for a security-sensitive function without reviewing its security implications.

Rule 11

Never disable TLS certificate validation in production.

Rule 12

Never store passwords in ExamFlow.

Rule 13

Never introduce a new external service without documenting the security implications.

Rule 14

Any change affecting authentication, authorization, student data, exam documents, or audit logging requires additional security review.

65. Security Review Checklist

Before production deployment:

Authentication
 University SSO configured
 MFA provided by institutional identity provider
 Token validation implemented
 Session expiration configured
 Logout tested
Authorization
 RBAC implemented
 Backend authorization enforced
 Object-level authorization tested
 Document access tested
Student Data
 Data minimization reviewed
 Student numbers protected
 Logs reviewed for PII
 Development data is synthetic
Exam Documents
 PDFs stored outside public web root
 Download authorization implemented
 Crowdmark QR codes preserved
 File permissions reviewed
Database
 Dedicated database user
 Database not publicly exposed
 Backups configured
 Restore tested
 Migrations reviewed
Infrastructure
 HTTPS enabled
 Firewall configured
 Application runs as non-root
 SSH secured
 Security updates enabled
 Monitoring configured
Application
 Input validation
 SQL injection protection
 CSRF protection where applicable
 CORS restricted
 Security headers configured
 Error messages sanitized
 Rate limiting configured
Audit
 Administrative actions logged
 Audit logs protected
 Document generation logged
 Assignment changes logged
66. Security Architecture Summary

The security model is:

                    University SSO
                         │
                         ▼
                    Authentication
                         │
                         ▼
                    Authorization
                         │
                         ▼
              ┌──────────────────────┐
              │       ExamFlow       │
              │                      │
              │  RBAC                │
              │  Validation          │
              │  Audit               │
              │  Business Rules      │
              └──────────┬───────────┘
                         │
              ┌──────────┴───────────┐
              ▼                      ▼
        PostgreSQL              File Storage
              │                      │
              │                      │
       Student Data             Exam PDFs
       Assignments              Seating Maps
       Audit Logs               Signature Lists
67. Final Security Principle

ExamFlow must be secure by default, private by default, and simple by design.

The system should not attempt to implement unnecessary security infrastructure itself.

Instead:

University SSO
      ↓
Authentication


ExamFlow RBAC
      ↓
Authorization


PostgreSQL
      ↓
Data Integrity


Secure File Storage
      ↓
Document Protection


Audit Logs
      ↓
Accountability


University Policies
      ↓
Privacy / Retention / Incident Response

The goal is not to create an unnecessarily complicated security platform.

The goal is to ensure that the right university employee can access the right examination information at the right time—and nobody else can.
