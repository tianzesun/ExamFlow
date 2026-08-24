# SSO Integration Guide

## Current Authentication

ExamFlow currently uses development-only token authentication:

- `dev-admin-token` → ADMIN role
- `dev-staff-token` → STAFF role
- `dev-instructor-token` → INSTRUCTOR role

This is suitable for development and pilot testing only.

## Institutional SSO Requirements

For production deployment, ExamFlow requires integration with the institutional identity provider (Microsoft Entra ID / Azure AD or equivalent).

### Identity Provider Assumptions

- IdP supports OpenID Connect (OIDC) or OAuth 2.0
- IdP provides user claims: `sub`, `email`, `name`, `groups`/`roles`
- IdP supports logout endpoint

### Authentication Flow

```
Browser → ExamFlow → Redirect to IdP
                         ↓
                    User authenticates
                         ↓
                    IdP returns tokens
                         ↓
ExamFlow validates tokens → Creates session → Redirects to app
```

### Callback Flow

1. User authenticates at IdP
2. IdP redirects to `OIDC_REDIRECT_URI` with authorization code
3. ExamFlow exchanges code for tokens
4. ExamFlow validates ID token (signature, issuer, audience, expiry)
5. ExamFlow extracts user claims
6. ExamFlow provisions or updates user record
7. ExamFlow creates session cookie
8. User is redirected to application

### User Identity Mapping

| IdP Claim | ExamFlow Field | Notes |
|-----------|---------------|-------|
| `sub` | `users.external_id` | Stable, immutable identifier |
| `email` | `users.email` | Used for display only |
| `name` | `users.full_name` | Used for display only |
| `groups` | `users.role` | Mapped via role mapping table |

### Role Mapping

| Institutional Group | ExamFlow Role |
|---------------------|---------------|
| Registrar Administrators | ADMIN |
| IITS Administrators | ADMIN |
| Exam Coordinators | STAFF |
| Instructors | INSTRUCTOR |
| Proctors (future) | INSTRUCTOR (read-only) |

Role mapping should be configured via environment variables or a simple configuration file, not hardcoded.

### Session Management

- Session stored in HttpOnly, Secure, SameSite=Strict cookie
- Session validated on each request via middleware
- Session invalidated on logout
- Session expires after configurable idle timeout (recommended: 8 hours for exam day)

### Logout

1. User clicks Logout
2. ExamFlow clears session cookie
3. ExamFlow redirects to IdP logout endpoint (if configured)
4. User is redirected to login page

### Account Provisioning

- **Automatic**: User is created on first successful SSO login
- **Role assignment**: Based on IdP group membership
- **Default role**: INSTRUCTOR (if no group mapping matches)

### Account Deprovisioning

When institutional access is removed:
- User can no longer authenticate via SSO
- Existing session is invalidated on next request
- User record is retained for audit trail
- User is deactivated (not deleted)

### Configuration Required

```bash
# OIDC Configuration
OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
OIDC_CLIENT_ID=<application-client-id>
OIDC_CLIENT_SECRET=<client-secret>
OIDC_REDIRECT_URI=https://examflow.university.ca/auth/callback
```

### Integration Boundary

The SSO integration is isolated in:
- `backend/app/auth/oidc_provider.py` (to be created)
- `backend/app/config.py` (OIDC settings)

No OIDC-specific code should be scattered throughout the application.

### Limitations

- OIDC integration not yet implemented (dev tokens only)
- Role mapping requires institutional configuration
- Multi-factor authentication handled by IdP, not ExamFlow
- Session timeout is application-level, not IdP-level

### Pilot Recommendation

For the controlled pilot, continue using dev tokens with the following controls:
- Restrict network access to pilot environment
- Use AUTH_DEV_MODE=true only in pilot environment
- Document all access via audit logs
- Plan OIDC integration before full deployment
