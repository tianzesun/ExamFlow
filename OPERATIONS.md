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
# Backend
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Frontend
cd frontend
npm run build
npm start
```

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
