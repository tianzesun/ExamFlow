# Pilot Acceptance Criteria

## Overview

This document defines the acceptance criteria for the ExamFlow pilot deployment.

## Acceptance Criteria

### 1. Exam Creation

**Criteria:** Administrator can create an exam with all required fields.

**Test:**
- Navigate to Exams → Create New Exam
- Fill in all required fields (course, name, date, time, duration, term)
- Submit form
- Verify exam appears in exam list

**Pass:** Exam is created and visible in the system.

### 2. Roster Import

**Criteria:** Administrator can import a student roster via CSV.

**Test:**
- Prepare CSV with student_number and name columns
- Navigate to Roster → Import CSV
- Upload CSV file
- Verify preview shows correct counts
- Confirm import
- Verify students appear in roster

**Pass:** All valid students are imported correctly.

### 3. Roster Validation

**Criteria:** System validates CSV before import.

**Test:**
- Upload CSV with missing student numbers
- Upload CSV with duplicate student numbers
- Upload CSV with missing names
- Verify error messages are clear

**Pass:** Invalid rows are rejected with clear error messages.

### 4. Room Configuration

**Criteria:** Administrator can create and configure rooms.

**Test:**
- Navigate to Rooms → Create Room
- Enter building, room number, capacity
- Create room
- Verify room appears in room list
- Verify seats are created

**Pass:** Room is created with correct capacity and seats.

### 5. Seating Assignment

**Criteria:** System can automatically assign students to seats.

**Test:**
- Select rooms for exam
- Preview seating assignment
- Verify all students are assigned
- Verify no conflicts
- Confirm assignment

**Pass:** All students have assigned seats with no conflicts.

### 6. Template Upload

**Criteria:** Administrator can upload a Crowdmark template.

**Test:**
- Export template from Crowdmark (or use test PDF)
- Navigate to Exam Template → Upload
- Upload PDF file
- Verify upload success
- Activate template

**Pass:** Template is uploaded and activated.

### 7. Document Generation

**Criteria:** System can generate personalized exam PDFs.

**Test:**
- Validate exam (all prerequisites met)
- Generate personalized exams
- Wait for completion
- Verify generated count matches student count
- Download sample PDF

**Pass:** All personalized exams are generated correctly.

### 8. QR Code Verification

**Criteria:** QR codes are present and scannable.

**Test:**
- Generate QR codes
- Open sample personalized PDF
- Locate QR code
- Scan QR code with mobile device
- Verify verification endpoint returns valid

**Pass:** QR code is visible and verifiable.

### 9. Signature List

**Criteria:** Signature lists are generated correctly.

**Test:**
- Generate signature lists
- Download PDF for each room
- Verify student names and IDs
- Verify seat ordering
- Verify page headers

**Pass:** Signature lists contain correct information.

### 10. Seating Map

**Criteria:** Seating maps are generated correctly.

**Test:**
- Generate seating maps
- Download PDF for each room
- Verify room layout
- Verify student assignments
- Verify seat labels

**Pass:** Seating maps accurately represent room configuration.

### 11. Administration Package

**Criteria:** Complete administration package can be generated.

**Test:**
- Generate administration package
- Download ZIP file
- Verify contents:
  - Exam summary
  - Personalized exams
  - Signature lists
  - Seating maps
- Verify no missing files

**Pass:** Package contains all required documents.

### 12. Access Control

**Criteria:** Unauthorized users cannot access confidential documents.

**Test:**
- Attempt to access exam without authentication → 401
- Attempt to download template with wrong exam ID → 403
- Attempt to generate exams without STAFF role → 403
- Verify QR verification is public (by design)

**Pass:** Access control prevents unauthorized access.

### 13. Audit Trail

**Criteria:** All important operations are logged.

**Test:**
- Create exam → verify audit log
- Import roster → verify audit log
- Generate seating → verify audit log
- Upload template → verify audit log
- Generate documents → verify audit log

**Pass:** Audit logs record all important operations.

### 14. Error Handling

**Criteria:** Errors are clear and actionable.

**Test:**
- Attempt to generate without template → clear error
- Attempt to generate without roster → clear error
- Attempt to generate without seating → clear error
- Verify error tells user what to do

**Pass:** Error messages tell users what went wrong and what to do next.

### 15. Performance

**Criteria:** System performs within acceptable limits.

**Test:**
- Import 100 students → < 5 seconds
- Generate seating for 100 students → < 10 seconds
- Generate 100 personalized exams → < 5 minutes
- Generate administration package → < 2 minutes

**Pass:** All operations complete within time limits.

## Sign-Off

| Criteria | Status | Verified By | Date |
|----------|--------|-------------|------|
| 1. Exam Creation | ☐ | | |
| 2. Roster Import | ☐ | | |
| 3. Roster Validation | ☐ | | |
| 4. Room Configuration | ☐ | | |
| 5. Seating Assignment | ☐ | | |
| 6. Template Upload | ☐ | | |
| 7. Document Generation | ☐ | | |
| 8. QR Code Verification | ☐ | | |
| 9. Signature List | ☐ | | |
| 10. Seating Map | ☐ | | |
| 11. Administration Package | ☐ | | |
| 12. Access Control | ☐ | | |
| 13. Audit Trail | ☐ | | |
| 14. Error Handling | ☐ | | |
| 15. Performance | ☐ | | |

**Overall Status:** ☐ PASS ☐ FAIL

**Sign-Off:** _________________________ Date: __________
