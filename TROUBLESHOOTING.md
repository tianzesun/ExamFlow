# Troubleshooting Guide

## Common Issues

### 1. Missing Template

**Symptom:** "No active template found" error when generating exams

**Cause:** No Crowdmark template has been uploaded, or the active template was archived

**Solution:**
1. Navigate to the exam page
2. Upload a Crowdmark PDF template
3. Ensure the template is activated
4. Retry generation

### 2. Invalid Roster

**Symptom:** CSV import fails or shows errors

**Cause:** Malformed CSV, missing columns, duplicate student IDs

**Solution:**
1. Verify CSV format:
   ```
   student_number,name
   100000001,Alice Student
   ```
2. Check for duplicate student numbers
3. Ensure all rows have both student_number and name
4. Use UTF-8 encoding

### 3. Missing Seats

**Symptom:** Not enough seats for all students

**Cause:** Room capacity insufficient or seats not configured

**Solution:**
1. Check room capacity matches student count
2. Verify seats are created for the room
3. Ensure seats are marked as Available
4. Add more rooms if needed

### 4. Duplicate Student Assignment

**Symptom:** "Student already assigned" error

**Cause:** Student already has a seat assignment in this exam

**Solution:**
1. Check existing assignments
2. Remove conflicting assignment if needed
3. Reassign to correct seat

### 5. Document Generation Failure

**Symptom:** Some or all exams fail to generate

**Cause:** Template file corrupted, insufficient disk space, or PDF processing error

**Solution:**
1. Check template file integrity (hash verification)
2. Verify disk space availability
3. Check application logs for specific errors
4. Re-upload template if corrupted
5. Retry generation

### 6. QR Code Failure

**Symptom:** QR codes not generated or not scannable

**Cause:** QR generation failed or token invalid

**Solution:**
1. Regenerate QR codes from Administration page
2. Verify QR tokens are assigned
3. Check PDF rendering (QR should be visible)
4. Test with QR scanner

### 7. Package Generation Failure

**Symptom:** Exam package cannot be generated

**Cause:** Missing prerequisites (no generated exams, missing rooms)

**Solution:**
1. Verify personalized exams are generated
2. Check rooms are selected for exam
3. Ensure all documents exist
4. Check disk space for ZIP creation

### 8. Permission Denied

**Symptom:** 403 Forbidden error

**Cause:** User role insufficient for operation

**Solution:**
1. Verify user role (ADMIN or STAFF required for write operations)
2. Check if user is authenticated
3. Verify token is valid
4. Contact administrator if role needs update

### 9. Stale Documents

**Symptom:** "Documents out of date" warning

**Cause:** Roster, seating, or template changed after documents were generated

**Solution:**
1. Review what changed
2. Regenerate affected documents
3. Regenerate QR codes if needed
4. Regenerate administration package

### 10. Database Connection Error

**Symptom:** "Database disconnected" in health check

**Cause:** Database server down, connection pool exhausted, or network issue

**Solution:**
1. Check database server status
2. Verify connection string
3. Check connection pool settings
4. Restart application if needed
5. Check network connectivity

### 11. File Upload Rejected

**Symptom:** "Only valid PDF files are supported" error

**Cause:** File is not a valid PDF or exceeds size limit

**Solution:**
1. Verify file is actually a PDF (not renamed)
2. Check file size (max 50MB)
3. Try re-exporting from Crowdmark
4. Check file is not corrupted

### 12. Seating Assignment Conflicts

**Symptom:** Cannot confirm seating assignment

**Cause:** Insufficient seats or conflicting assignments

**Solution:**
1. Check total seats >= student count
2. Verify no seats are disabled
3. Review room selection
4. Add more rooms if needed

### 13. Status Transition Error

**Symptom:** "Cannot transition from X to Y" error

**Cause:** Invalid status change attempted

**Solution:**
1. Check current exam status
2. Review valid transitions:
   - DRAFT → CONFIGURED, ARCHIVED
   - CONFIGURED → READY, DRAFT, ARCHIVED
   - READY → GENERATED, CONFIGURED, ARCHIVED
   - GENERATED → COMPLETED, READY, ARCHIVED
   - COMPLETED → ARCHIVED
   - ARCHIVED → (none)

### 14. CSV Encoding Error

**Symptom:** "File must be UTF-8 encoded" error

**Cause:** CSV file not saved in UTF-8 format

**Solution:**
1. Open CSV in text editor
2. Save as UTF-8 (with or without BOM)
3. Re-upload

### 15. Large File Slow Upload

**Symptom:** Upload timeout or slow performance

**Cause:** Large file size or network issues

**Solution:**
1. Compress PDF if possible
2. Check network connection
3. Try smaller file
4. Contact administrator

## Getting Help

If issues persist:
1. Check application logs
2. Verify health check status
3. Review audit log for recent operations
4. Contact system administrator
5. Reference this troubleshooting guide
