# Backlog

## Overview

This document tracks planned improvements for ExamFlow, prioritized by importance.

## Priority Levels

| Priority | Description | Timeline |
|----------|-------------|----------|
| P0 | Production blocker | Before production deployment |
| P1 | Important | Next development cycle |
| P2 | Future improvement | When resources available |
| P3 | Nice to have | Low priority |

---

## P0 — Production Blockers

### P0-001: OIDC/SSO Integration
- **Description:** Implement OpenID Connect authentication with institutional identity provider
- **Impact:** Required for production deployment
- **Scope:** Backend auth module, configuration, user provisioning
- **Status:** Done in code — UTORid sign-in through Microsoft Entra ID (see SSO-INTEGRATION.md). Needs the app registration and role assignments in the UofT tenant before use.

### P0-002: Session Management
- **Description:** Implement session expiry, server-side logout, secure cookie configuration
- **Impact:** Required for production security
- **Scope:** Backend session handling, frontend logout
- **Status:** Covered by Entra — ExamFlow keeps no session of its own; sign-in length, MFA and sign-out are set in Entra ID, and tokens end with the browser tab.

### P0-003: Rate Limiting
- **Description:** Add rate limiting to sensitive endpoints (login, upload, generation)
- **Impact:** Prevent abuse in production
- **Scope:** Backend middleware
- **Status:** Done — limits on test sign-in, the QR check, uploads, generation and print/package downloads (OPERATIONS.md › Rate limits). In-memory per server process; move to a shared store if exact limits across workers are ever needed.

---

## P1 — Important

### P1-001: Login/Logout Audit Events
- **Description:** Log authentication events (login, logout, failed attempts)
- **Impact:** Complete audit trail
- **Scope:** Auth module, audit logging
- **Status:** Done — Admin › Activity › Sign-in and access shows each sign-in (UTORid or test account), each sign-out, and refused sign-ins (a UTORid without an ExamFlow role, with its email; or an account switched off in ExamFlow). Token renewals during a session aren't counted as sign-ins; invalid tokens aren't logged.

### P1-002: File Download Audit
- **Description:** Log all file download events
- **Impact:** Track document access
- **Scope:** PDF/template endpoints
- **Status:** Done — every exam document download is in the audit log under its exam: print file, package, single papers, uploaded exam papers, signature lists, seating maps and seating lists (Admin › Activity)

### P1-003: Background Workers
- **Description:** Move document generation to background workers
- **Impact:** Better UX for large exams
- **Scope:** Worker infrastructure, task queue
- **Status:** Done — generation runs as a background job (`generation_jobs` table, `POST /api/exams/{id}/generated/jobs`). It runs in the API process, not a separate worker queue; revisit if generation load grows.

### P1-004: Progress Indication
- **Description:** Show progress during document generation
- **Impact:** Better user experience
- **Scope:** Frontend, backend streaming
- **Status:** Done — the Exam papers page polls `.../generated/jobs/latest` and shows a progress bar; it resumes after a page refresh.

### P1-005: Exam-Level Access Control
- **Description:** Scope read access to exam ownership
- **Impact:** Better security for multi-tenant use
- **Scope:** All read endpoints
- **Status:** Done — instructors and TAs see only courses the exam office added them to (by sign-in email, on the course page), with those courses' exams and students. ADMIN and STAFF see everything.

---

## P2 — Future Improvement

### P2-001: S3/Object Storage
- **Description:** Support S3-compatible object storage for documents
- **Impact:** Scalability, reliability
- **Scope:** Storage abstraction layer
- **Status:** Not started

### P2-002: API Documentation
- **Description:** Generate OpenAPI/Swagger documentation
- **Impact:** Developer experience
- **Scope:** FastAPI automatic docs
- **Status:** Not started

### P2-003: Integration Tests
- **Description:** Add integration tests against PostgreSQL
- **Impact:** Better test coverage
- **Scope:** Test infrastructure
- **Status:** Not started

### P2-004: End-to-End Tests
- **Description:** Add browser-based end-to-end tests
- **Impact:** UI regression prevention
- **Scope:** Playwright/Cypress setup
- **Status:** Not started

### P2-005: Data Export
- **Description:** Export roster/assignments to CSV
- **Impact:** Interoperability
- **Scope:** New API endpoints
- **Status:** Partly done. The seating list (name, student number, UTORid, room, seat) downloads as CSV; a roster-only export is still open

### P2-006: Bulk Operations
- **Description:** Bulk import, bulk assign, bulk generate
- **Impact:** Efficiency for large exams
- **Scope:** New API endpoints, frontend
- **Status:** Not started

### P2-007: Exam Archival Automation
- **Description:** Automatic archival after exam date
- **Impact:** Data management
- **Scope:** Scheduled task
- **Status:** Not started

### P2-008: Data Retention
- **Description:** Implement configurable data retention policies
- **Impact:** Compliance
- **Scope:** Background job, configuration
- **Status:** Not started

---

## P3 — Nice to Have

### P3-001: Dashboard Improvements
- **Description:** Enhanced dashboard with charts, recent activity, notifications
- **Impact:** Better UX
- **Scope:** Frontend
- **Status:** Not started

### P3-002: Dark Mode Toggle
- **Description:** Manual dark/light mode toggle
- **Impact:** User preference
- **Scope:** Frontend
- **Status:** Not started

### P3-003: Keyboard Shortcuts
- **Description:** Keyboard shortcuts for common operations
- **Impact:** Power user efficiency
- **Scope:** Frontend
- **Status:** Not started

### P3-004: Print Preview
- **Description:** In-browser print preview for documents
- **Impact:** Better print workflow
- **Scope:** Frontend
- **Status:** Not started

### P3-005: Email Notifications
- **Description:** Email notifications for generation completion, errors
- **Impact:** User awareness
- **Scope:** Email service integration
- **Status:** Not started

### P3-006: Multi-Language Support
- **Description:** Internationalization for non-English users
- **Impact:** Accessibility
- **Scope:** Frontend i18n
- **Status:** Not started

### P3-007: Crowdmark API Integration
- **Description:** Direct API integration with Crowdmark
- **Impact:** Automation
- **Scope:** Integration module
- **Status:** Not started

### P3-008: SIS Integration
- **Description:** Integration with Student Information System
- **Impact:** Roster automation
- **Scope:** Integration module
- **Status:** Not started

---

## Rules

1. P0 items must be completed before production deployment
2. P1 items should be completed in the next development cycle
3. P2 items are planned but not scheduled
4. P3 items are aspirational
5. New items should be added to the appropriate priority level
6. Items should be reviewed and reprioritized quarterly
7. Completed items should be moved to a "Done" section (not in this file)
