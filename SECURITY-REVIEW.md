# Security Review

Where ExamFlow stands on security, checked against the code on **2026-10-31**. It replaces the
August pilot review, most of whose open items are now fixed. For what data is held, see
[DATA-CLASSIFICATION.md](DATA-CLASSIFICATION.md); for who can do what,
[AUTHORIZATION-MATRIX.md](AUTHORIZATION-MATRIX.md).

## Authentication

| Item | Status | Notes |
|------|:------:|-------|
| UTORid sign-in through Microsoft Entra ID | DONE, not yet live | Needs the app registration ([request](doc/requests/ENTRA-APP-REGISTRATION-REQUEST.md)) |
| Every request's token checked | PASS | RS256 signature from Microsoft's published keys; issuer, tenant, audience, `access_as_user` scope, expiry, `oid` (`backend/app/auth/entra.py`, `tests/test_entra.py`) |
| Access needs an Entra app role | PASS | No default role; a valid UofT sign-in without one is refused |
| Session length, MFA, sign-out | PASS | Owned by Entra; ExamFlow keeps no session. Tokens live in the tab's `sessionStorage`; sign-out ends the Microsoft session for ExamFlow |
| Test accounts | PASS | Only when `APP_ENV` is development, test or pilot; the server refuses to start with them switched on anywhere else |
| No client secret | PASS | Single-page app with PKCE |

## Authorization

| Item | Status | Notes |
|------|:------:|-------|
| Writes need ADMIN or STAFF | PASS | Attendance also allows INSTRUCTOR and TA, for invigilators |
| Reads limited to a person's courses | PASS | Every `/api/exams/{id}` and `/api/courses/{id}` route checks course access; others' exams answer 404 |
| Accommodation notes | PASS | Returned to ADMIN and STAFF only |
| Cross-exam object access | PASS | Papers, uploads, seats and assignments are checked against their exam |
| Switching someone off | PASS | Admin › People; takes effect on the next request |

## Files

| Item | Status | Notes |
|------|:------:|-------|
| Upload checks | PASS | PDF header, MIME type, 50 MB limit; CSVs UTF-8 with checked columns and field lengths |
| Storage names | PASS | Random UUID file names; no user input in paths |
| Download names | PASS | ASCII fallback plus encoded UTF-8 name |
| Exam-day package | PASS | Folder and file names cleaned (no `..`, no collisions) |
| Uploaded PDFs are parsed on the server | OPEN (medium) | PyMuPDF opens staff-uploaded PDFs to stamp them. Only signed-in exam office staff can upload. Keep PyMuPDF patched; consider running generation with limited privileges |

## QR codes

| Item | Status | Notes |
|------|:------:|-------|
| Tokens | PASS | 32 random bytes (`secrets.token_urlsafe`) |
| Public check | BY DESIGN | Says whether the paper is current, with course, exam and date only; no student details; rate limited; logged |
| Replaced papers | PASS | A superseded paper's QR code reports that it has been replaced |

## Audit logging

| Item | Status | Notes |
|------|:------:|-------|
| Changes | PASS | Courses, exams, rosters, accommodations, rooms, seating, papers, attendance, access |
| Downloads | PASS | Print file, package, single papers, uploads, signature lists, seating maps, seating lists |
| People | PASS | First sign-in, role changes from Entra, switching on and off |
| Each sign-in | NOT LOGGED | Entra's sign-in logs cover this; ExamFlow records first sign-in only |
| Viewing | PASS | Admin › Activity, ADMIN only |

## Requests and responses

| Item | Status | Notes |
|------|:------:|-------|
| Input validation | PASS | Pydantic schemas; empty values for required fields refused; times with a zone offset refused |
| Errors | PASS | Generic message plus a request ID; traceback logged on the server only |
| Rate limits | PASS | Sign-in, QR check, uploads, generation, print and package; per server process |
| Security headers | PASS | nosniff, frame DENY, referrer policy, permissions policy, HSTS outside development |
| Content-Security-Policy | ACCEPTED (medium) | `unsafe-inline` and `unsafe-eval` in `script-src` for Next.js; allows `login.microsoftonline.com` for sign-in |

## Secrets and dependencies

| Item | Status | Notes |
|------|:------:|-------|
| Secrets in the repository | PASS | None; env files are ignored. The only secret is the database URL, which should come from the server's secret store |
| Dependency monitoring | OPEN (medium) | No automated `pip-audit` / `npm audit` yet; add one to CI before production |

## Open items before production

1. Entra app registration and role assignments (UTORid sign-in can't be used before then).
2. Information Risk Assessment, including the accommodation-notes and retention questions in
   [DATA-CLASSIFICATION.md](DATA-CLASSIFICATION.md#risks-to-confirm).
3. Confirm disk encryption and backups on the production server.
4. Automated dependency checks.
5. Keep PyMuPDF patched (uploaded PDFs are parsed on the server).
6. Retention and deletion rules.
