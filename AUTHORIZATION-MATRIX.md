# Authorization Matrix

## Overview

ExamFlow uses Role-Based Access Control (RBAC) with three roles:
- **ADMIN** — Full system access
- **STAFF** — Exam management access
- **INSTRUCTOR** — Read-only access

## Roles

| Role | Description |
|------|-------------|
| ADMIN | System administrators, Registrar office |
| STAFF | Exam coordinators, IITS support |
| INSTRUCTOR | Course instructors, read-only |

## Resource Authorization Matrix

### Courses

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| List courses | ✓ | ✓ | ✓ |
| View course | ✓ | ✓ | ✓ |
| Create course | ✓ | ✓ | — |
| Update course | ✓ | ✓ | — |

### Exams

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| List exams | ✓ | ✓ | ✓ |
| View exam | ✓ | ✓ | ✓ |
| Create exam | ✓ | ✓ | — |
| Update exam | ✓ | ✓ | — |
| Change exam status | ✓ | ✓ | — |

### Roster

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| View roster | ✓ | ✓ | ✓ |
| Import roster (preview) | ✓ | ✓ | ✓ |
| Import roster (confirm) | ✓ | ✓ | — |
| Remove student from roster | ✓ | ✓ | — |

### Rooms

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| List rooms | ✓ | ✓ | ✓ |
| View room | ✓ | ✓ | ✓ |
| Create room | ✓ | — | — |
| Delete room | ✓ | — | — |

### Seating Assignments

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| View assignments | ✓ | ✓ | ✓ |
| View assignment summary | ✓ | ✓ | ✓ |
| Add exam room | ✓ | ✓ | — |
| Remove exam room | ✓ | ✓ | — |
| Preview assignment | ✓ | ✓ | — |
| Confirm assignment | ✓ | ✓ | — |
| Regenerate assignment | ✓ | ✓ | — |
| Manual assign seat | ✓ | ✓ | — |
| Manual unassign seat | ✓ | ✓ | — |

### Templates

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| List templates | ✓ | ✓ | ✓ |
| View template | ✓ | ✓ | ✓ |
| Download template | ✓ | ✓ | ✓ |
| Upload template | ✓ | ✓ | — |
| Activate template | ✓ | ✓ | — |
| Archive template | ✓ | ✓ | — |

### Generated Exams

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| List generated exams | ✓ | ✓ | ✓ |
| Validate generation | ✓ | ✓ | ✓ |
| Generate personalized exams | ✓ | ✓ | — |
| Download generated exam | ✓ | ✓ | ✓ |

### Administration

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| Generate QR codes | ✓ | ✓ | — |
| Verify QR (public) | ✓ | ✓ | ✓ |
| Download signature list | ✓ | ✓ | ✓ |
| Download seating map | ✓ | ✓ | ✓ |
| Generate exam package | ✓ | ✓ | — |
| Download exam package | ✓ | ✓ | — |

### System

| Operation | ADMIN | STAFF | INSTRUCTOR |
|-----------|:-----:|:-----:|:----------:|
| Health check | ✓ | ✓ | ✓ |
| View audit logs | ✓ | — | — |
| Manage users | ✓ | — | — |
| System configuration | ✓ | — | — |

## Object-Level Authorization

Access to resources is scoped by exam ownership:

- Template access requires `template.exam_id == requested_exam_id`
- Generated exam access requires `generated_exam.exam_id == requested_exam_id`
- Assignment access requires `assignment.exam_id == requested_exam_id`
- Roster access requires `exam_student.exam_id == requested_exam_id`

## IDOR Protection

| Resource | IDOR Protected | Mechanism |
|----------|:--------------:|-----------|
| Templates | ✓ | `_verify_template_ownership()` |
| Generated exams | ✓ | `_verify_generated_ownership()` |
| Assignments | Partial | `exam_id` in URL path |
| Signature lists | ✓ | `exam_id` in URL path |
| Seating maps | ✓ | `exam_id` in URL path |
| Rooms | N/A | Global resources |

## Public Endpoints

| Endpoint | Authentication | Authorization |
|----------|:--------------:|:-------------:|
| `GET /health` | None | None |
| `GET /api/verify/{token}` | None | None (QR verification) |

## Notes

1. INSTRUCTOR role is read-only for exam data
2. All write operations require ADMIN or STAFF role
3. Room creation/deletion is ADMIN only
4. QR verification is public by design (for proctor use)
5. Audit logs are ADMIN only
6. Object-level authorization prevents cross-exam access
