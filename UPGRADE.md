# Upgrade Procedure

## Overview

This document describes how to upgrade ExamFlow to a new version.

## Prerequisites

- Access to server
- Database credentials
- Backup of current system
- Release notes for new version

## Upgrade Steps

### 1. Pre-Upgrade

```bash
# Verify current version
cd /path/to/examflow
git log --oneline -1

# Verify health check
curl http://localhost:8000/health

# Create backup
pg_dump -U examflow examflow > backup_$(date +%Y%m%d_%H%M%S).sql
tar -czf storage_$(date +%Y%m%d_%H%M%S).tar.gz storage/
```

### 2. Maintenance Window

```bash
# Stop application (if using systemd)
sudo systemctl stop examflow

# Or stop manually
kill $(pgrep -f "uvicorn app.main:app")
```

### 3. Deploy New Version

```bash
# Pull new code
git fetch origin
git checkout v1.0.1  # or appropriate tag

# Install backend dependencies
cd backend
source .venv/bin/activate
pip install -r requirements.txt  # or pip install -e .

# Install frontend dependencies
cd ../frontend
npm install

# Build frontend
npm run build
```

### 4. Database Migration

```bash
# Run migrations
cd ../backend
alembic upgrade head

# Verify migration
alembic current
```

### 5. Start Application

```bash
# Start backend
cd /path/to/examflow/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend
cd /path/to/examflow/frontend
npm start &
```

### 6. Post-Upgrade Verification

```bash
# Verify health check
curl http://localhost:8000/health

# Verify authentication
curl -H "Authorization: Bearer dev-admin-token" http://localhost:8000/api/auth/me

# Verify database connection
curl http://localhost:8000/health | jq '.database'

# Check logs
tail -f /var/log/examflow/app.log
```

### 7. Functional Verification

1. Login to application
2. Create a test exam
3. Import a test roster
4. Generate seating
5. Upload a template
6. Generate documents
7. Verify package generation

### 8. Cleanup

```bash
# Remove old backup (after verification)
# rm backup_OLD.sql

# Remove old storage backup (after verification)
# rm storage_OLD.tar.gz
```

## Rollback Procedure

If upgrade fails:

### Option 1: Application Rollback

```bash
# Stop new version
sudo systemctl stop examflow

# Checkout old version
git checkout v1.0.0

# Restart
sudo systemctl start examflow
```

### Option 2: Database Rollback

```bash
# Restore database
dropdb examflow
createdb examflow
psql examflow < backup_YYYYMMDD_HHMMSS.sql

# Run old migrations
cd backend
git checkout v1.0.0
alembic upgrade head
```

### Option 3: Full Restore

```bash
# Restore database
psql examflow < backup_YYYYMMDD_HHMMSS.sql

# Restore storage
tar -xzf storage_YYYYMMDD_HHMMSS.tar.gz

# Deploy old version
git checkout v1.0.0
```

## Version-Specific Notes

### v1.0.0-pilot → v1.0.0

- No breaking changes expected
- Database migrations are backward compatible
- Configuration remains the same

## Troubleshooting

### Migration Fails

```bash
# Check migration status
alembic current

# Check migration history
alembic history

# If needed, stamp to specific revision
alembic stamp head
```

### Application Won't Start

```bash
# Check logs
tail -50 /var/log/examflow/app.log

# Check database connection
psql -U examflow -c "SELECT 1"

# Check environment variables
env | grep DATABASE_URL
```

### Performance Issues

```bash
# Check database connections
psql -U examflow -c "SELECT count(*) FROM pg_stat_activity"

# Check disk space
df -h

# Check memory
free -m
```

## Notes

1. Always backup before upgrading
2. Always test in pilot environment first
3. Always verify health check after upgrade
4. Document any issues encountered
5. Keep upgrade notes for future reference
