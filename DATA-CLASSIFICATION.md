# Data Classification Guide

## Purpose

This document classifies data handled by ExamFlow according to sensitivity and institutional policy.

## Classification Levels

| Level | Description | Handling Requirements |
|-------|-------------|----------------------|
| **CONFIDENTIAL** | Sensitive exam content and student PII | Encrypted at rest, access controlled, audit logged |
| **RESTRICTED** | Internal operational data | Access controlled, audit logged |
| **INTERNAL** | System configuration and metadata | Access controlled |

## Data Classification Table

### Exam Content

| Data Item | Classification | Storage | Access Control | Retention |
|-----------|---------------|---------|----------------|-----------|
| Exam template (original) | CONFIDENTIAL | Filesystem (./storage) | Authenticated + exam ownership | Per institutional policy |
| Personalized exam PDFs | CONFIDENTIAL | Filesystem (./storage) | Authenticated + exam ownership | Per institutional policy |
| Exam questions | NOT STORED | Crowdmark only | N/A | N/A |
| Exam answers | NOT STORED | Crowdmark only | N/A | N/A |

### Student Information

| Data Item | Classification | Storage | Access Control | Retention |
|-----------|---------------|---------|----------------|-----------|
| Student name | CONFIDENTIAL | PostgreSQL | Authenticated + exam scope | Per institutional policy |
| Student ID number | CONFIDENTIAL | PostgreSQL | Authenticated + exam scope | Per institutional policy |
| Student email | NOT STORED | N/A | N/A | N/A |
| Student demographics | NOT STORED | N/A | N/A | N/A |

### Seating & Assignment

| Data Item | Classification | Storage | Access Control | Retention |
|-----------|---------------|---------|----------------|-----------|
| Room assignment | RESTRICTED | PostgreSQL | Authenticated + exam scope | Per institutional policy |
| Seat assignment | RESTRICTED | PostgreSQL | Authenticated + exam scope | Per institutional policy |
| Seating map | RESTRICTED | Filesystem (generated) | Authenticated + exam scope | Per institutional policy |
| Signature list | RESTRICTED | Filesystem (generated) | Authenticated + exam scope | Per institutional policy |

### QR & Verification

| Data Item | Classification | Storage | Access Control | Retention |
|-----------|---------------|---------|----------------|-----------|
| QR token | RESTRICTED | PostgreSQL | Public (verify endpoint) | Per institutional policy |
| QR verification log | INTERNAL | PostgreSQL (audit_logs) | Admin/Staff only | Per institutional policy |

### System Data

| Data Item | Classification | Storage | Access Control | Retention |
|-----------|---------------|---------|----------------|-----------|
| User accounts | INTERNAL | PostgreSQL | Admin only | Indefinite |
| Audit logs | INTERNAL | PostgreSQL | Admin only | Per institutional policy |
| Application config | INTERNAL | Environment vars | Server only | N/A |
| Database credentials | CONFIDENTIAL | Environment vars | Server only | Rotated per policy |

## Data Minimization

ExamFlow stores only the minimum data required for exam administration:

- **No birth dates**
- **No personal addresses**
- **No phone numbers**
- **No financial information**
- **No health information**
- **No grades or academic records**

Student data is limited to:
- Student number (for identification on exam day)
- Full name (for identification on exam day)

## Data Retention

### Current Policy

No specific retention periods are defined. All data is retained until manually deleted.

### Recommended Policy (Requires Institutional Approval)

| Data Type | Recommended Retention | Action After Retention |
|-----------|----------------------|----------------------|
| Exam templates | 2 years after exam | Archive |
| Personalized exams | 1 year after exam | Delete |
| Seating assignments | 2 years after exam | Archive |
| Signature lists | 2 years after exam | Archive |
| Audit logs | 5 years | Archive |
| User accounts | While active | Deactivate |

### Data Disposition

When retention period expires:
1. Data is moved to archive storage
2. After additional period, data is securely deleted
3. Deletion is logged in audit trail

## Data in Transit

| Connection | Protection |
|-----------|------------|
| Browser → ExamFlow | HTTPS (TLS 1.2+) |
| ExamFlow → Database | SSL/TLS (configurable) |
| ExamFlow → Filesystem | Local (no network) |

## Data at Rest

| Storage | Protection |
|---------|------------|
| PostgreSQL | Encrypted at rest (institutional) |
| Filesystem | Filesystem permissions (chmod) |
| Backups | Encrypted backups (institutional) |

## Access Logging

All access to confidential data is logged:
- Who accessed the data
- When it was accessed
- What action was performed
- Which resource was accessed

## Data Exposure Prevention

ExamFlow prevents data exposure through:
1. Authentication required for all endpoints (except health check and QR verify)
2. Role-based authorization (ADMIN, STAFF, INSTRUCTOR)
3. Object-level authorization (exam ownership verification)
4. No student data in application logs
5. No student data in error messages
6. No student data in browser console

## Institutional Confirmation Required

The following require institutional confirmation:
- Specific retention periods
- Encryption at rest requirements
- Backup retention policy
- Data disposal procedures
- Breach notification requirements
- Cross-border data transfer restrictions
