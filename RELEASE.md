# Release Process

## Overview

This document defines the release process for ExamFlow.

## Versioning

ExamFlow uses semantic versioning: `MAJOR.MINOR.PATCH`

| Component | Description |
|-----------|-------------|
| MAJOR | Breaking changes |
| MINOR | New features, backward compatible |
| PATCH | Bug fixes, backward compatible |

### Version Labels

| Label | Description |
|-------|-------------|
| `-dev` | Development build |
| `-pilot` | Pilot deployment |
| `-rc` | Release candidate |
| (none) | Stable release |

### Current Version

**ExamFlow v1.0.0-pilot**

## Release Environments

| Environment | Purpose | Database | Storage |
|-------------|---------|----------|---------|
| Development | Local development | dev DB | local |
| Pilot | Controlled testing | pilot DB | pilot storage |
| Production | Live system | prod DB | prod storage |

## Release Flow

### 1. Development

1. Create feature branch from `main`
2. Implement changes
3. Run tests: `pytest tests/`
4. Run lint: `ruff check app/`
5. Run build: `npm run build`
6. Create pull request
7. Code review
8. Merge to `main`

### 2. Staging

1. Deploy `main` to pilot environment
2. Run smoke tests
3. Verify health check
4. Test critical workflows
5. Document any issues

### 3. Pilot Release

1. Tag release: `git tag v1.0.0-pilot`
2. Deploy to pilot environment
3. Run pilot test script
4. Collect feedback
5. Address critical issues

### 4. Production Release

1. Verify pilot acceptance criteria met
2. Create release branch: `git checkout -b release/v1.0.0`
3. Final testing
4. Tag release: `git tag v1.0.0`
5. Deploy to production
6. Verify health check
7. Monitor for issues
8. Announce release

## Release Checklist

### Pre-Release

- [ ] All tests passing
- [ ] Lint clean
- [ ] Build successful
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Database migrations tested
- [ ] Backup verified

### Deployment

- [ ] Backup database
- [ ] Backup storage
- [ ] Deploy application
- [ ] Run migrations
- [ ] Verify health check
- [ ] Verify authentication
- [ ] Verify critical workflows
- [ ] Monitor logs

### Post-Release

- [ ] Smoke tests passed
- [ ] User notification sent
- [ ] Documentation published
- [ ] Support team notified
- [ ] Monitoring active

## Rollback Procedure

If issues are detected after release:

1. **Immediate:** Revert to previous version
2. **Database:** Restore from backup if migration was applied
3. **Storage:** Restore from backup if needed
4. **Communication:** Notify users of rollback
5. **Investigation:** Identify root cause
6. **Fix:** Apply fix and re-release

## Release Notes Format

```markdown
# ExamFlow v1.0.0

## New Features
- Feature 1
- Feature 2

## Bug Fixes
- Fix 1
- Fix 2

## Known Issues
- Issue 1

## Upgrade Instructions
1. Step 1
2. Step 2
```

## Emergency Release

For critical security or data issues:

1. Create hotfix branch
2. Apply minimal fix
3. Test thoroughly
4. Deploy immediately
5. Document after deployment

## Notes

1. Never deploy untested code to production
2. Always backup before deployment
3. Always verify health check after deployment
4. Always monitor after deployment
5. Document all releases
