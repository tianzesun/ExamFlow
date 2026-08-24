# Pilot Test Script

## Overview

Step-by-step test script for the ExamFlow pilot.

## Pre-Test Setup

1. Verify pilot environment is running
2. Verify database is migrated
3. Verify test data is available
4. Verify documentation is accessible

## Test Cases

### TEST-001: Create Exam

**Steps:**
1. Login as STAFF user
2. Navigate to Exams
3. Click "Create New Exam"
4. Fill in:
   - Course: Select existing or create new
   - Exam Name: "Final Examination"
   - Exam Date: Select future date
   - Start Time: 14:00
   - Duration: 180 minutes
   - Term: Fall
   - Academic Year: 2026
5. Click "Create"

**Expected:** Exam is created, redirected to exam detail page.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-002: Import Roster

**Steps:**
1. Navigate to exam → Roster
2. Click "Import CSV"
3. Upload test CSV file
4. Review preview:
   - Total rows: ___
   - Valid rows: ___
   - Errors: ___
5. Click "Confirm Import"

**Expected:** All valid students imported.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-003: Validate Roster

**Steps:**
1. Review roster list
2. Verify student count
3. Check for any errors
4. Verify student numbers are correct

**Expected:** Roster matches CSV file.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-004: Configure Rooms

**Steps:**
1. Navigate to Rooms
2. Click "Create Room"
3. Enter:
   - Building: "IA"
   - Room Number: "3010"
   - Capacity: 50
4. Click "Create"
5. Verify room appears in list
6. Click on room to view seats

**Expected:** Room created with 50 seats.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-005: Select Rooms for Exam

**Steps:**
1. Navigate to exam → Seating
2. Click "Add Room"
3. Select room "IA 3010"
4. Verify room is added

**Expected:** Room selected for exam.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-006: Generate Seating

**Steps:**
1. On Seating page, click "Preview Assignment"
2. Review preview:
   - Students to assign: ___
   - Available seats: ___
   - Conflicts: ___
3. Click "Confirm Assignment"

**Expected:** All students assigned, no conflicts.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-007: Import Crowdmark Template

**Steps:**
1. Navigate to exam → Exam Template
2. Click "Upload"
3. Select PDF file (Crowdmark export or test PDF)
4. Wait for upload
5. Verify template appears in list
6. Click "Activate"

**Expected:** Template uploaded and activated.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-008: Generate Personalized Documents

**Steps:**
1. Navigate to exam → Documents
2. Click "Validate" → all checks pass
3. Click "Generate Exams"
4. Wait for generation to complete
5. Verify count: Generated ___ / Failed ___
6. Click "Download" on sample PDF

**Expected:** All exams generated, PDF downloads correctly.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-009: Verify QR Code

**Steps:**
1. Open downloaded PDF
2. Locate QR code on first page
3. Scan with mobile device QR scanner
4. Verify verification page shows "Valid Exam Document"

**Expected:** QR code is scannable and valid.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-010: Generate Signature List

**Steps:**
1. Navigate to exam → Administration
2. Find room in "Room Documents" table
3. Click "Download PDF" for Signature List
4. Open PDF
5. Verify:
   - Room name is correct
   - Students are listed in seat order
   - Student IDs are correct
   - Signature column is present

**Expected:** Signature list is correct.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-011: Generate Seating Map

**Steps:**
1. On Administration page, find room
2. Click "Download PDF" for Seating Map
3. Open PDF
4. Verify:
   - Room layout is visible
   - Seat labels are correct
   - Student names are in correct seats
   - FRONT indicator is present

**Expected:** Seating map is correct.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-012: Generate Administration Package

**Steps:**
1. Navigate to exam → Administration
2. Review status checklist (all should be ✓)
3. Click "Generate Exam Package"
4. Review confirmation dialog
5. Click "Generate Package"
6. Wait for generation
7. Click "Download Package"

**Expected:** Package downloads successfully.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-013: Verify Package Contents

**Steps:**
1. Extract ZIP file
2. Verify directory structure:
   - Exam-Summary.pdf
   - Personalized-Exams/ (all student PDFs)
   - Rooms/ (signature lists and seating maps)
   - README.txt
3. Open Exam-Summary.pdf
4. Verify student count and room count

**Expected:** Package contains all expected files.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-014: Unauthorized Access Test

**Steps:**
1. Logout
2. Attempt to access /app/exams → should redirect to login
3. Attempt to access API directly → should return 401
4. Login as INSTRUCTOR
5. Attempt to generate exams → should return 403
6. Attempt to create room → should return 403

**Expected:** Unauthorized access is prevented.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

### TEST-015: Audit Log Review

**Steps:**
1. Login as ADMIN
2. Navigate to Admin page
3. Review audit logs
4. Verify logs show:
   - Exam creation
   - Roster import
   - Seating assignment
   - Template upload
   - Document generation

**Expected:** Audit trail is complete.

**Status:** ☐ PASS ☐ FAIL

**Notes:** _________________________

## Summary

| Test | Status |
|------|--------|
| TEST-001 | ☐ |
| TEST-002 | ☐ |
| TEST-003 | ☐ |
| TEST-004 | ☐ |
| TEST-005 | ☐ |
| TEST-006 | ☐ |
| TEST-007 | ☐ |
| TEST-008 | ☐ |
| TEST-009 | ☐ |
| TEST-010 | ☐ |
| TEST-011 | ☐ |
| TEST-012 | ☐ |
| TEST-013 | ☐ |
| TEST-014 | ☐ |
| TEST-015 | ☐ |

**Overall Result:** ☐ PASS ☐ FAIL

**Tested By:** _________________________ Date: __________
