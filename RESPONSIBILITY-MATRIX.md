# Responsibility Matrix

## Overview

This document defines who performs each task in the exam administration workflow.

## Roles

| Role | Description | Typical Users |
|------|-------------|---------------|
| Registrar Administrator | System-level configuration, user management | Registrar office staff |
| Exam Coordinator | Exam setup, roster, seating, document generation | Exam coordinators, IITS |
| Instructor | Course-level view access | Course instructors |
| IITS Support | Technical support, deployment, monitoring | IITS staff |

## Task Responsibility Matrix

### System Administration

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| System deployment | — | — | — | ✓ |
| Database management | — | — | — | ✓ |
| User account creation | ✓ | — | — | ✓ |
| User role assignment | ✓ | — | — | — |
| System monitoring | — | — | — | ✓ |
| Backup management | — | — | — | ✓ |
| Security review | ✓ | — | — | ✓ |

### Exam Setup

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Create course | ✓ | ✓ | — | — |
| Create exam | ✓ | ✓ | — | — |
| Set exam date/time | ✓ | ✓ | ✓ | — |
| Configure exam details | ✓ | ✓ | — | — |

### Roster Management

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Obtain student roster | — | ✓ | ✓ | — |
| Prepare CSV file | — | ✓ | ✓ | — |
| Import roster | ✓ | ✓ | — | — |
| Verify roster | ✓ | ✓ | ✓ | — |
| Remove students | ✓ | ✓ | — | — |

### Room & Seat Management

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Create rooms | ✓ | — | — | — |
| Configure seats | ✓ | — | — | — |
| Select rooms for exam | ✓ | ✓ | — | — |
| Disable seats | ✓ | ✓ | — | — |

### Seating Assignment

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Generate seating | ✓ | ✓ | — | — |
| Review seating | ✓ | ✓ | ✓ | — |
| Manual adjustments | ✓ | ✓ | — | — |
| Confirm seating | ✓ | ✓ | — | — |

### Template Management

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Export from Crowdmark | — | ✓ | ✓ | — |
| Upload template | ✓ | ✓ | — | — |
| Activate template | ✓ | ✓ | — | — |
| Verify template | ✓ | ✓ | ✓ | — |

### Document Generation

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Validate exam | ✓ | ✓ | ✓ | — |
| Generate personalized exams | ✓ | ✓ | — | — |
| Generate QR codes | ✓ | ✓ | — | — |
| Generate signature lists | ✓ | ✓ | — | — |
| Generate seating maps | ✓ | ✓ | — | — |
| Generate admin package | ✓ | ✓ | — | — |
| Download package | ✓ | ✓ | — | — |

### Print & Distribution

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Print exams | ✓ | ✓ | — | — |
| Print signature lists | ✓ | ✓ | — | — |
| Print seating maps | ✓ | ✓ | — | — |
| Organize by room | ✓ | ✓ | — | — |
| Distribute to rooms | ✓ | ✓ | ✓ | — |

### Exam Day

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Monitor exam | ✓ | ✓ | ✓ | — |
| Verify attendance | — | ✓ | ✓ | — |
| Handle issues | ✓ | ✓ | — | — |

### Post-Exam

| Task | Registrar | Exam Coordinator | Instructor | IITS |
|------|:---------:|:----------------:|:----------:|:----:|
| Complete exam status | ✓ | ✓ | — | — |
| Archive exam | ✓ | ✓ | — | — |
| Verify audit trail | ✓ | — | — | — |

## Decision Authority

| Decision | Authority | Notes |
|----------|-----------|-------|
| Exam creation | Registrar/Coordinator | Must be authorized by department |
| Roster approval | Instructor/Coordinator | Instructor verifies student list |
| Seating changes | Coordinator | After initial generation |
| Template activation | Coordinator | Must be Crowdmark export |
| Document generation | Coordinator | After all prerequisites met |
| Package distribution | Coordinator | Controls printing workflow |
| System access | Registrar/IITS | User role assignment |
| Data retention | Registrar/IITS | Per institutional policy |

## Escalation Path

| Issue | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Exam setup question | Exam Coordinator | Registrar | — |
| Technical issue | IITS Support | Developer | — |
| Security concern | Registrar | IITS | Developer |
| Data issue | Exam Coordinator | Registrar | — |
| System outage | IITS Support | Developer | — |

## Notes

1. Exam Coordinators are the primary users for exam setup
2. Registrar has final authority on system configuration
3. Instructors have read-only access to their courses
4. IITS handles deployment and technical infrastructure
5. Responsibilities may overlap for small institutions
