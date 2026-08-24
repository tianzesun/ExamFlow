# Support Model

## Overview

This document defines the proposed support model for ExamFlow.

## Support Tiers

### Tier 1: Exam Coordinator Support

**Who:** Registrar exam administrators, designated exam coordinators

**Responsibilities:**
- Day-to-day exam setup and configuration
- Roster import and verification
- Seating assignment and adjustment
- Template upload and activation
- Document generation and printing
- Exam day administration
- First-line user assistance

**Scope:**
- Workflow questions
- Data entry issues
- Template compatibility
- Printing issues
- Exam day support

**Availability:**
- During business hours
- Extended hours during exam periods

### Tier 2: IITS Application Support

**Who:** IITS support staff, application administrators

**Responsibilities:**
- System administration
- User account management
- Database management
- Backup and recovery
- Monitoring and alerting
- Configuration changes
- Issue investigation

**Scope:**
- System configuration
- User access issues
- Database issues
- Storage issues
- Performance issues
- Security incidents

**Availability:**
- Business hours
- On-call during exam periods

### Tier 3: Developer Support

**Who:** Application developers, infrastructure team

**Responsibilities:**
- Bug fixes
- Feature development
- Security patches
- Performance optimization
- Architecture decisions
- Code review

**Scope:**
- Application bugs
- Security vulnerabilities
- Feature requests
- Infrastructure changes
- Database migrations

**Availability:**
- On-call for critical issues
- Regular development hours

## Escalation Procedures

### From Tier 1 to Tier 2

Escalate when:
- Issue cannot be resolved with documentation
- System configuration change needed
- User access issue
- Database issue suspected

Procedure:
1. Document the issue
2. Include steps to reproduce
3. Include error messages
4. Contact IITS support

### From Tier 2 to Tier 3

Escalate when:
- Application bug suspected
- Security vulnerability found
- Performance degradation
- Infrastructure issue

Procedure:
1. Document the issue
2. Include logs and error details
3. Include impact assessment
4. Contact development team

## Support Contacts

| Tier | Contact | Hours |
|------|---------|-------|
| Tier 1 | Registrar Office | Business hours |
| Tier 2 | IITS Help Desk | Business hours + on-call |
| Tier 3 | Development Team | On-call for critical |

## Incident Severity Levels

| Level | Description | Response Time | Resolution Time |
|-------|-------------|---------------|-----------------|
| P0 | System unavailable | 1 hour | 4 hours |
| P1 | Critical feature broken | 4 hours | 24 hours |
| P2 | Non-critical issue | 24 hours | 72 hours |
| P3 | Enhancement request | 1 week | Scheduled |

## Documentation

Support documentation:
- `TROUBLESHOOTING.md` — Common issues and solutions
- `OPERATIONS.md` — System operations guide
- `REGISTRAR-WORKFLOW.md` — Workflow guide
- `PILOT-WORKFLOW.md` — Pilot workflow

## Communication

- Email for non-urgent issues
- Phone/Teams for urgent issues
- Ticketing system for tracking (if available)

## Training

- Tier 1: Workflow training, documentation review
- Tier 2: System administration training
- Tier 3: Codebase walkthrough, architecture review

## Notes

1. This is a proposed model — adjust based on institutional structure
2. For small institutions, tiers may overlap
3. Documentation should be maintained by Tier 2/3
4. Training materials should be created for Tier 1
