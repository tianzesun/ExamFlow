# Pilot Workflow Guide

## Overview

This document defines the complete workflow for the controlled pilot deployment of ExamFlow.

## Pilot Scope

- **Department:** Registrar's Office / IITS
- **Courses:** 1-2 courses per pilot
- **Students:** 100-200 students per exam
- **Rooms:** 2-4 rooms per exam
- **Duration:** 2-4 weeks

## Prerequisites

Before starting the pilot:

1. ✅ Pilot environment configured
2. ✅ Database migrated and seeded
3. ✅ Synthetic test data prepared
4. ✅ Documentation reviewed
5. ✅ Support contacts established
6. ✅ Feedback mechanism ready

## Pilot Workflow

### Phase 1: Setup (Day 1)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 1.1 | Verify pilot environment | IITS | Check database, storage, auth |
| 1.2 | Create test course | Exam Coordinator | Use synthetic data |
| 1.3 | Create test exam | Exam Coordinator | Set realistic date/time |
| 1.4 | Verify exam appears in list | Exam Coordinator | Check UI |

### Phase 2: Roster (Day 1-2)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 2.1 | Prepare CSV file | Exam Coordinator | Use synthetic student data |
| 2.2 | Upload CSV preview | Exam Coordinator | Verify counts |
| 2.3 | Confirm import | Exam Coordinator | Review imported students |
| 2.4 | Verify roster | Exam Coordinator | Check student list |

### Phase 3: Rooms (Day 2-3)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 3.1 | Create rooms | Registrar | Or use existing rooms |
| 3.2 | Configure seats | Registrar | Verify capacity |
| 3.3 | Select rooms for exam | Exam Coordinator | Match student count |
| 3.4 | Verify room selection | Exam Coordinator | Check assignment page |

### Phase 4: Seating (Day 3-4)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 4.1 | Preview seating assignment | Exam Coordinator | Review algorithm output |
| 4.2 | Review assignment details | Exam Coordinator | Check student-seat mapping |
| 4.3 | Make adjustments if needed | Exam Coordinator | Manual changes |
| 4.4 | Confirm assignment | Exam Coordinator | Lock in assignments |

### Phase 5: Template (Day 4-5)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 5.1 | Export from Crowdmark | Exam Coordinator | Real or test template |
| 5.2 | Upload template | Exam Coordinator | Verify upload success |
| 5.3 | Activate template | Exam Coordinator | Set as active |
| 5.4 | Verify template | Exam Coordinator | Check template details |

### Phase 6: Documents (Day 5-6)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 6.1 | Validate exam | Exam Coordinator | Check all prerequisites |
| 6.2 | Generate personalized exams | Exam Coordinator | Wait for completion |
| 6.3 | Verify generation | Exam Coordinator | Check generated count |
| 6.4 | Download sample PDF | Exam Coordinator | Verify content |

### Phase 7: Administration (Day 6-7)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 7.1 | Generate QR codes | Exam Coordinator | Assign tokens |
| 7.2 | Generate signature lists | Exam Coordinator | Download PDFs |
| 7.3 | Generate seating maps | Exam Coordinator | Download PDFs |
| 7.4 | Generate admin package | Exam Coordinator | Create ZIP |
| 7.5 | Download package | Exam Coordinator | Verify contents |

### Phase 8: Verification (Day 7-8)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 8.1 | Verify package contents | Exam Coordinator | Check all files |
| 8.2 | Verify PDF content | Exam Coordinator | Check student info |
| 8.3 | Verify QR codes | Exam Coordinator | Test scanning |
| 8.4 | Verify signature lists | Exam Coordinator | Check formatting |
| 8.5 | Verify seating maps | Exam Coordinator | Check layout |

### Phase 9: Print Test (Day 8-9)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 9.1 | Print sample exam | Exam Coordinator | Test QR readability |
| 9.2 | Print signature list | Exam Coordinator | Test formatting |
| 9.3 | Print seating map | Exam Coordinator | Test layout |
| 9.4 | Document any issues | Exam Coordinator | Note problems |

### Phase 10: Feedback (Day 9-10)

| Step | Task | Responsible | Notes |
|------|------|-------------|-------|
| 10.1 | Complete feedback form | All | What worked/didn't |
| 10.2 | Review feedback | IITS | Collect responses |
| 10.3 | Document lessons learned | IITS | Create summary |
| 10.4 | Plan improvements | IITS/Registrar | Prioritize changes |

## Acceptance Criteria

The pilot is successful when:

1. ✅ Exam can be created
2. ✅ Roster can be imported
3. ✅ Rooms can be configured
4. ✅ Seating can be assigned
5. ✅ Template can be uploaded
6. ✅ Personalized exams can be generated
7. ✅ QR codes are present and scannable
8. ✅ Signature lists are correct
9. ✅ Seating maps are correct
10. ✅ Administration package is complete
11. ✅ Unauthorized users cannot access documents
12. ✅ Audit events are recorded
13. ✅ No critical security issues remain
14. ✅ Support documentation is adequate

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| System unavailable | Backup environment ready |
| Data loss | Regular backups |
| Security incident | Incident response plan |
| User error | Documentation and training |
| Performance issue | Load testing before pilot |

## Communication Plan

| Event | Audience | Method |
|-------|----------|--------|
| Pilot kickoff | All stakeholders | Meeting |
| Weekly status | Registrar/IITS | Email |
| Issue escalation | Support team | Teams/Email |
| Pilot completion | All stakeholders | Meeting |
| Lessons learned | All stakeholders | Document |

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Setup time | < 30 minutes | — |
| Roster import | < 5 minutes | — |
| Seating generation | < 1 minute | — |
| Document generation | < 10 minutes | — |
| Package generation | < 5 minutes | — |
| User satisfaction | > 4/5 | — |
| Critical issues | 0 | — |
