# ExamFlow Production Checklist

## Security

- [ ] AUTH_DEV_MODE=false in production
- [ ] OIDC configured (OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET)
- [ ] CORS_ALLOWED_ORIGINS set to production domain only
- [ ] HTTPS enforced (Strict-Transport-Security header)
- [ ] No secrets committed to git
- [ ] .env files excluded from version control
- [ ] CSP headers configured (no unsafe-eval in production if possible)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Rate limiting configured for sensitive endpoints
- [ ] IDOR protection verified on all resource endpoints
- [ ] Audit logging enabled for all write operations

## Database

- [ ] PostgreSQL running with connection pooling
- [ ] Alembic migrations up to date (alembic upgrade head)
- [ ] Database backups configured per institutional policy
- [ ] Connection pool size appropriate (default: 10, overflow: 20)
- [ ] pool_pre_ping=True for connection health
- [ ] pool_recycle=3600 to prevent stale connections

## Storage

- [ ] Document storage path secured (not in public/static directories)
- [ ] File upload size limits enforced (50MB templates)
- [ ] PDF validation on upload (magic bytes, not just extension)
- [ ] Safe filenames (UUID-based, no path traversal)
- [ ] Storage disk space monitored

## Authentication

- [ ] Dev tokens disabled in production
- [ ] Session expiration configured
- [ ] Logout endpoint implemented
- [ ] Cookie security flags set (Secure, HttpOnly, SameSite)

## Authorization

- [ ] Role-based access enforced (ADMIN, STAFF, INSTRUCTOR)
- [ ] Object-level authorization on all resource endpoints
- [ ] IDOR protection verified
- [ ] Exam ownership verified for template/download operations

## Backups

- [ ] Database backup schedule defined
- [ ] Document storage backup schedule defined
- [ ] Backup restoration tested
- [ ] Backup retention policy defined

## Monitoring

- [ ] Health check endpoint (/health) accessible
- [ ] Database connectivity verified in health check
- [ ] Application logs captured
- [ ] Error rate monitoring configured
- [ ] Storage disk space monitoring

## Logging

- [ ] Structured logging enabled
- [ ] Request IDs included in responses
- [ ] Sensitive data excluded from logs (passwords, tokens, student names)
- [ ] Log level appropriate for environment

## Testing

- [ ] All tests passing
- [ ] Lint clean
- [ ] TypeScript build successful
- [ ] End-to-end workflow tested with synthetic data

## Documentation

- [ ] PRODUCTION-CHECKLIST.md reviewed
- [ ] REGISTRAR-WORKFLOW.md documented
- [ ] OPERATIONS.md available
- [ ] TROUBLESHOOTING.md available

## Deployment

- [ ] Production database configured
- [ ] Production storage configured
- [ ] Production CORS origins configured
- [ ] Production auth configured
- [ ] HTTPS enabled
- [ ] Static file serving configured
- [ ] Reverse proxy configured (Apache/Nginx)
