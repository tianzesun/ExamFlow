# Registrar Workflow Guide

This document describes the complete workflow for exam administrators using ExamFlow.

## Prerequisites

- Access to ExamFlow with ADMIN or STAFF role
- Crowdmark exam template (PDF export)
- Student roster (CSV format)
- Room and seat configurations

## Workflow Steps

### 1. Create Exam

1. Navigate to Exams → Create New Exam
2. Select course
3. Enter exam details:
   - Exam Name
   - Exam Date
   - Start Time
   - Duration
   - Term
4. Click Create

### 2. Verify Exam Details

1. Review exam details on the exam page
2. Verify date, time, and duration
3. Confirm course information is correct
4. To change the name, term, date, time or duration, choose **Edit** on the Exam details card. Changes are recorded
   in Admin › Activity.
   - Moving the date or time keeps everyone's seat. If another exam then uses the same seats at the same time,
     ExamFlow says so straight away, and the readiness check blocks printing until those students are moved.
   - Renaming the exam makes generated papers out of date, because the name is printed on them. Generate them
     again on Exam papers before printing.

### 3. Import Student Roster

1. Navigate to Roster
2. Click Import CSV
3. Upload CSV file with format:
   ```
   student_number,name
   100000001,Alice Student
   100000002,Bob Student
   ```
4. Review preview:
   - Total rows
   - Valid rows
   - Duplicates
   - Errors
5. Confirm import

### 4. Verify Roster

1. Check student count matches expectations
2. Review student list for accuracy
3. Remove or correct any errors

### 5. Configure Rooms

1. Navigate to Rooms → Create Room (or select existing)
2. Enter room details:
   - Building
   - Room Number
   - Capacity
3. Create seats for the room

### 6. Configure Seats

1. Select room
2. Verify seat layout (rows × columns)
3. Ensure seat count matches room capacity
4. Mark any unavailable seats as Disabled

### 7. Generate Seating

1. Navigate to Seating
2. Select rooms for this exam
3. Click Preview Assignment
4. Review the assignment preview:
   - Students assigned
   - Seats available
   - Conflicts (should be 0)
5. Click Confirm Assignment

Seating rules worth knowing: **Rooms › Spread evenly across rooms** gives each room the same share of
its seats instead of packing the first room, and **Front row › Leave the front row empty** keeps row 1
free for proctors and latecomers. Both keep each room to one block of names or numbers, so door signs
still work.

If a room booking changes after seating, use the move button beside the room on the Seating page:
pick the new room from its floor plan and everyone in the old room moves there in the same order.
Nobody else moves, so only those students' papers need regenerating and reprinting.

### 8. Review Seating

1. Review the seating list
2. Verify each student has a seat
3. Make manual adjustments if needed
4. On Exam day, print the door signs: an entrance poster listing every room, then one sign per room
   saying who writes there ("Names A to Kim", or student number ranges). Seating by name or by student
   number gives each room one block; after manual moves that break the blocks, the signs send students
   to the seating list instead.

### 9. Import Crowdmark Template

1. Navigate to Exam Template
2. Upload Crowdmark PDF template
3. Optionally enter Crowdmark metadata
4. Verify upload success

### 10. Activate Template

1. Ensure the uploaded template is active
2. If multiple versions exist, activate the correct one

### 11. Validate Exam

1. Navigate to Documents
2. Click Validate
3. Verify all checks pass:
   - Active template found
   - Students in roster
   - Seating assignments complete
   - No conflicts

### 12. Generate Personalized Exams

1. Click Generate Exams
2. Wait for generation to complete
3. Review results:
   - Generated count
   - Failed count (should be 0)

### 13. Verify QR Codes

1. Navigate to Administration
2. Click Generate QR Codes
3. Verify QR tokens assigned to all documents

### 14. Generate Administration Package

1. Click Generate Exam Package
2. Review confirmation dialog
3. Confirm generation
4. Wait for package creation

### 15. Download Package

1. Click Download Package
2. Verify ZIP file downloads
3. Extract and verify contents:
   - Exam Summary PDF
   - Per-room Signature Lists
   - Per-room Seating Maps
   - Personalized Exam PDFs

### 16. Verify Package

1. Open Exam Summary PDF
2. Verify student count and room count
3. Open a few personalized exam PDFs
4. Verify student name, ID, room, seat are correct
5. Verify QR code is visible

### 17. Print Exams

1. Print personalized exam PDFs
2. Organize by room

### 18. Print Signature Lists

1. Print signature lists (one per room)
2. Verify student order matches seating

### 19. Print Seating Maps

1. Print seating maps (one per room)
2. Verify layout matches room configuration

### 20. Conduct Exam

1. Distribute exams to rooms
2. Use signature lists for attendance
3. Use seating maps for student direction

### 21. Archive Exam

1. After exam completion, navigate to exam
2. Change status to COMPLETED
3. Then change status to ARCHIVED
4. Verify archival

## Post-Exam

- Verify all documents are archived
- Confirm audit log shows all operations
- Backup exam data per institutional policy
