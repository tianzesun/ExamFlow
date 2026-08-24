# Known Limitations

## Overview

This document records known limitations of ExamFlow v1.0.0-pilot.

## Authentication

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Dev token authentication only | No real user identity verification | Restrict network access |
| No SSO/OIDC integration | Cannot use institutional identity | Planned for production |
| No session expiry | Sessions persist indefinitely | Manual logout required |
| No server-side logout | Client-side session clear only | Browser cookie clear |
| No multi-factor authentication | MFA handled by IdP (not implemented) | Acceptable for pilot |

## Authorization

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| All authenticated users can read all exams | No exam-level scoping for reads | Acceptable for pilot |
| No course-level access control | Instructors see all exams | Intentional design |
| No instructor-specific restrictions | Instructors have full read access | Acceptable for pilot |

## Crowdmark Integration

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Manual template export required | No automated import | Manual workflow documented |
| No Crowdmark API integration | Cannot sync rosters or exams | File-based workflow |
| No bidirectional sync | Changes in Crowdmark not reflected | Manual re-import |
| No submission linking | Cannot link to Crowdmark submissions | Out of scope |
| No grade integration | Cannot import/export grades | Out of scope |

## Document Generation

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Synchronous generation | Large exams may be slow | Acceptable for <1000 students |
| No background workers | Generation blocks HTTP request | Acceptable for pilot |
| No progress indication | User sees loading spinner only | Acceptable for small exams |
| No generation retry | Failed generation requires manual retry | Acceptable for pilot |

## Data Management

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No data retention policy | Data retained indefinitely | Manual cleanup |
| No exam archival automation | Manual status change required | Workflow documented |
| No bulk operations | One exam at a time | Acceptable for pilot |
| No data export | Cannot export to SIS | Out of scope |

## User Management

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No user deprovisioning | deactivated users retain records | Acceptable for pilot |
| No role-based dashboard | Same view for all roles | Acceptable for pilot |
| No user profile management | No self-service profile | Acceptable for pilot |

## System

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Local filesystem storage | No S3/object storage | Acceptable for pilot |
| No CDN | Static assets served directly | Acceptable for pilot |
| No horizontal scaling | Single server deployment | Acceptable for pilot |
| No caching | Repeated queries hit database | Acceptable for pilot |

## Monitoring

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No application monitoring | Basic health check only | Acceptable for pilot |
| No error tracking | Logs only | Acceptable for pilot |
| No performance metrics | Manual measurement | Acceptable for pilot |
| No alerting | Manual monitoring | Acceptable for pilot |

## Testing

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No integration tests against PostgreSQL | Tests use SQLite | Acceptable for pilot |
| No end-to-end browser tests | Manual testing only | Acceptable for pilot |
| No load testing | Manual performance check | Acceptable for pilot |
| No security scanning | Manual security review | Acceptable for pilot |

## Documentation

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No API documentation (Swagger) | Developers must read code | Acceptable for pilot |
| No user training materials | Documentation only | Acceptable for pilot |
| No video tutorials | Self-service learning | Acceptable for pilot |

## Deployment

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No Dockerfile for app | Manual deployment | Acceptable for pilot |
| No CI/CD pipeline | Manual build and deploy | Acceptable for pilot |
| No staging environment | Dev/prod only | Acceptable for pilot |
| No automated backups | Manual backup required | Acceptable for pilot |

## Future Improvements (Backlog)

| Item | Priority | Phase |
|------|:--------:|-------|
| OIDC/SSO integration | P0 | Production |
| Session expiry | P1 | Production |
| Background workers | P2 | Future |
| S3 storage | P2 | Future |
| API documentation | P2 | Future |
| Integration tests | P2 | Future |
| CI/CD pipeline | P3 | Future |
| Monitoring/alerting | P3 | Future |

## Notes

1. These limitations are acceptable for a controlled pilot
2. Items marked P0/P1 should be addressed before full production
3. Items marked P2/P3 can be deferred to future phases
4. All limitations are documented for transparency
