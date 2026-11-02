# Data Classification and Inventory

What ExamFlow stores, where it goes and who can see it. Written as input to the university's
Information Risk Assessment (uoft.me/Information-Risk-Assessment). The levels are **proposed**,
using the University of Toronto's data classification (L1 public to L4 highly restricted), and
need confirming with Information Security.

*Last checked against the code: 2026-10-31.*

## Summary

ExamFlow holds identifying student information (L3): names, student numbers, UTORids, emails,
where each student sits and exam accommodations. Staff identities come from Entra ID. Nothing is
sent outside the university except the sign-in itself, which goes to the university's own Entra
tenant on Microsoft's service.

The one item that could become **L4** is the free-text **accommodation notes** field. Staff are
told on screen not to record medical details there; see [Risks to confirm](#risks-to-confirm).

## Inventory

### Students

| Data | Proposed level | Where | Who can see it |
|------|:--------------:|-------|----------------|
| Full name, student number | L3 | PostgreSQL `students`; printed on each paper and on seating and signature lists | ADMIN, STAFF; INSTRUCTOR/TA for their courses |
| UTORid, email (if in the imported roster) | L3 | PostgreSQL `students` | as above |
| Room and seat for each exam | L3 | PostgreSQL `exam_assignments`; on papers and lists | as above |
| Extra time (minutes) | L3 | PostgreSQL `exam_students` | as above |
| Accommodation notes (free text) | L3, **L4 if medical details are entered** | PostgreSQL `exam_students` | ADMIN, STAFF only |
| Attendance (present/absent, time, who checked them in) | L3 | PostgreSQL `exam_students` | ADMIN, STAFF; INSTRUCTOR/TA for their courses |

Not stored: dates of birth, addresses, phone numbers, grades, financial data, exam answers.

### Exam documents

| Data | Proposed level | Where | Who can see it |
|------|:--------------:|-------|----------------|
| Uploaded exam paper (from Crowdmark) | L3 (assessment content before the exam) | Server filesystem `storage/exams/<exam>/templates/` | ADMIN, STAFF; INSTRUCTOR/TA for their courses |
| Personalized papers (name, number, room, seat, QR code) | L3 | `storage/exams/<exam>/generated/` | as above |
| Seating lists, signature lists, seating maps, exam-day package | L3 | Generated on request, not stored | as above |
| Door signs (room, exam, time, and a range such as "Names A to Kim" or "Student numbers 9944900… to 9944905…") | L2 (only the shortest name or number starts that separate the rooms; no full name or number) | Generated on request, not stored | as above; meant to be posted at the rooms |
| QR token on each paper | L2 | PostgreSQL `generated_exams` | Public check at `/verify/<token>`: answers only whether the paper is current, with course code, exam name and date, **no student details** |

### Staff and access

| Data | Proposed level | Where | Who can see it |
|------|:--------------:|-------|----------------|
| Staff name, sign-in email, ExamFlow role | L2 | PostgreSQL `users` (created at first sign-in from the Entra token) | ADMIN |
| Course access list (instructor/TA emails per course) | L2 | PostgreSQL `course_access` | ADMIN, STAFF; people on the course |
| Audit log | L3 (entries can name students and staff) | PostgreSQL `audit_logs` | ADMIN only (Admin › Activity) |

The audit log records changes, downloads and QR checks with who, when and what. Some entries hold
a student number (seat changes, papers downloaded), staff emails (course access) and, for QR
checks, the checking device's IP address.

### Course and timetable data

Course codes, names and meeting times from the Timetable Builder are public (L1).

## Where data goes

| Flow | What | Protection |
|------|------|------------|
| Browser ⇄ ExamFlow | Everything above | HTTPS, set up at the university proxy |
| Browser ⇄ Microsoft Entra ID (UofT tenant) | Sign-in only; ExamFlow receives an access token | Microsoft's service, the university's tenant policies (MFA, Conditional Access) |
| ExamFlow → Microsoft | Fetches Entra's public signing keys | HTTPS, certificate checks on |
| ExamFlow → Timetable Builder | Requests public course data | HTTPS |
| Staff → Crowdmark | Staff export the exam PDF from Crowdmark and upload it by hand | ExamFlow doesn't connect to Crowdmark |
| ExamFlow ⇄ PostgreSQL | All records | Server network; TLS depends on the database setup |

**In the browser:** a UTORid sign-in's tokens are kept in `sessionStorage` and end when the tab
closes. Test accounts (development and pilot only) keep a fixed token in `localStorage`.

**In server logs:** each request is logged with its path, status, time and request ID. Paths
contain record IDs, not names. A server error logs a full traceback, which can include values
from the failing request.

## Access control

- Every page and API needs a sign-in, except the health check and the QR check.
- Roles come from Entra app roles; there is no default role. ADMIN and STAFF see every course.
  INSTRUCTOR and TA see only the courses the exam office added them to, and read-only except for
  attendance. See [AUTHORIZATION-MATRIX.md](AUTHORIZATION-MATRIX.md).
- An administrator can switch a person off in ExamFlow at once (Admin › People).
- Rate limits guard sign-in, uploads, generation and the QR check ([OPERATIONS.md](OPERATIONS.md)).

## Retention: decisions needed

ExamFlow can delete papers, uploaded exam papers and rosters a set number of days after each exam
(Admin › Settings › Keeping data; runs daily and archives the exam). Every period is empty, so nothing
is deleted, until an administrator sets it. The periods themselves still need approval:

| Data | Today | Suggested (needs approval) |
|------|-------|----------------------------|
| Personalized papers (files) | Kept until the exam is deleted or the student removed from it | Delete 1 year after the exam |
| Uploaded exam papers | Kept until the exam is deleted | 2 years after the exam |
| Seating, attendance, accommodations | Kept with the exam | 2 years after the exam |
| Student records (name, number, UTORid, email) | Shared across exams; **never deleted**, even when every exam they were in is deleted | Delete when no exam refers to them |
| Audit log | Kept indefinitely | Per university records schedule |
| Staff accounts | Kept; can be switched off | Switch off when the Entra role is removed |

## Risks to confirm

1. **Accommodation notes.** Free text, ADMIN and STAFF only, with an on-screen warning not to
   enter medical details. If medical information is entered anyway, the data becomes L4. Options:
   accept with training; replace free text with fixed choices (e.g. "separate room", "computer");
   or remove the field and keep only extra time.
2. **Storage at rest.** Papers are files on the server's disk; the database and files rely on the
   host's disk encryption and backups, which aren't part of ExamFlow. This needs confirming for
   the production server.
3. **Retention.** Deletion is built but off until the periods above are approved and set.
4. **Tracebacks in logs** can contain request values; logs need the same protection as the
   database.
