# Operations Guide

## Startup

### Development

```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

### Production

```bash
# Backend (behind the university's proxy or load balancer)
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 \
  --proxy-headers --forwarded-allow-ips=<proxy address>

# Frontend
cd frontend
npm run build
npm start
```

`--proxy-headers` makes the server see each browser's own address rather than the proxy's.
The rate limits on test sign-in and the public QR check count per address, so without it
every visitor would share one count.

### Rate limits

Abuse guards in `backend/app/rate_limit.py`; going over one answers **429** with a
`Retry-After` header.

| What | Limit | Counted per |
|------|-------|-------------|
| Test-account sign-in (`/api/auth/login`) | 10 a minute | address |
| QR check on a paper (`/api/verify/...`) | 60 a minute | address |
| Roster imports and paper uploads | 30 per 10 minutes | person |
| Paper generation (full or update) | 20 per 10 minutes | person |
| Print file, paper preview, exam-day package | 30 per 10 minutes | person |

Counts are kept in each server process, so with 4 workers someone can reach up to 4 times
these figures. Set `RATE_LIMITS_ENABLED=false` to switch them off (e.g. for load testing).

## Shutdown

Send SIGTERM to the process. The application will:
1. Complete in-flight requests
2. Close database connections
3. Release resources

## Database Migrations

```bash
cd backend

# Apply all migrations
alembic upgrade head

# Check current version
alembic current

# Create new migration
alembic revision --autogenerate -m "description"
```

## Backup

### Database

```bash
# Export
pg_dump -U examflow examflow > backup_$(date +%Y%m%d).sql

# Import
psql -U examflow examflow < backup_YYYYMMDD.sql
```

### Document Storage

```bash
# Backup storage directory
tar -czf storage_$(date +%Y%m%d).tar.gz storage/
```

## Restore

### Database

```bash
# Drop and recreate
dropdb examflow
createdb examflow
psql examflow < backup_YYYYMMDD.sql

# Apply migrations
alembic upgrade head
```

### Document Storage

```bash
# Restore storage
tar -xzf storage_YYYYMMDD.tar.gz
```

## Health Check

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "0.1.0",
  "environment": "production"
}
```

## Logs

Application logs are structured and include:
- Request ID
- Timestamp
- Method, path, status code
- Duration

Log levels:
- INFO: Normal operations
- WARNING: Configuration issues
- ERROR: Failures requiring attention

## Storage

Document storage location: `./storage/`

Structure:
```
storage/
└── exams/
    └── {exam_id}/
        ├── templates/
        │   └── template-{uuid}.pdf
        └── generated/
            └── {uuid}.pdf
```

## Monitoring

### Key Metrics

- Request rate and latency
- Error rate (4xx, 5xx)
- Database connection pool usage
- Storage disk usage
- Generation failure rate

### Alerts

Configure alerts for:
- Application unavailability
- Database connection failures
- High error rate (>1%)
- Storage disk space low (<10%)
- Generation failure rate high

## Settings in the app (Admin › Settings)

Administrators change these in ExamFlow itself; each change is in Admin › Activity under Settings. They apply from the next timetable sync, new exam, upload or document. Courses and exams already in ExamFlow stay as they are; generated papers go out of date when the paper stamp settings change.

| Setting | Default | Used by |
|---------|---------|---------|
| Department name | Computer Science | Courses the timetable sync adds |
| Division code | ARTSC | Timetable sync |
| Course code prefixes | CSC | Timetable sync (only courses starting with these) |
| Seating for new exams (order, spacing, paper versions, rooms, front row) | By student number, every seat, one version, each room in turn, front row used | New exams; each exam can change its own |
| Largest exam paper upload | 50 MB | Exam paper uploads (1–200 MB) |
| Paper stamp: student name, UTORid, every page | Name on, UTORid off, every page on | Generated papers. Room, seat and QR code are always printed. A change makes existing papers out of date, so "Update papers" regenerates them |
| Exam-day document heading | None | Signature lists, seating lists, seating maps, door signs, exam summary |
| New exam duration and start time | 120 minutes, no time | The new-exam form |

**UTORid sign-in** (Entra tenant ID, client ID, API scope and the app role value for each ExamFlow role) can be entered on the same page. None of it is secret — ExamFlow signs in as a single-page app and has no client secret. If `ENTRA_TENANT_ID` and `ENTRA_CLIENT_ID` are set in the environment they take priority and the page shows them locked; pin them there in production so a compromised admin account can't point sign-in elsewhere. The page refuses a tenant ID Microsoft doesn't know, and won't turn UTORid sign-in off while test accounts are off. If a wrong client ID locks everyone out, set the correct values in the environment file and restart.

Everything else about the deployment (database, URLs, rate limits) stays in the environment file. The Settings page shows it read only.

## Upgrades

1. Backup database
2. Backup storage
3. Pull new code
4. Run migrations: `alembic upgrade head`
5. Restart application
6. Verify health check
7. Test critical workflows

## Security

### Regular Reviews

- Review access logs
- Audit user roles
- Check for unauthorized access attempts
- Review file upload patterns
- Monitor QR verification attempts

### Incident Response

1. Identify the issue
2. Contain if necessary (disable affected accounts)
3. Investigate audit logs
4. remediate
5. Document findings
6. Update security measures
