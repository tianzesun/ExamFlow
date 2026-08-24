# ExamFlow

**Version:** v1.0.0-pilot

A university examination administration system designed to simplify examination preparation, seating assignment, and personalized exam document generation.

ExamFlow does not replace Crowdmark. ExamFlow simplifies the administrative work that happens around Crowdmark.

## Features

- Exam management with status lifecycle
- Student roster import via CSV
- Room and seat management
- Automatic seating assignment
- Crowdmark template import
- Personalized exam PDF generation
- QR code generation and verification
- Signature list generation
- Seating map generation
- Administration package (ZIP) generation
- Role-based access control (ADMIN, STAFF, INSTRUCTOR)
- Audit logging
- Health check with database probe

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 |
| Database | PostgreSQL 16 |
| Migration | Alembic |
| PDF | PyMuPDF |
| Testing | pytest |
| Linting | Ruff |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 16+

### Setup

```bash
# Clone repository
git clone <repository-url>
cd ExamFlow

# Configure environment
cp .env.example .env.local
# Edit .env.local with your database credentials

# Start database (Docker)
docker-compose up -d

# Setup backend
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Setup frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Development Login

Use dev tokens to login:
- `dev-admin-token` → ADMIN role
- `dev-staff-token` → STAFF role
- `dev-instructor-token` → INSTRUCTOR role

## Project Structure

```
ExamFlow/
├── README.md
├── .env.example
├── docker-compose.yml
├── doc/                    # Project documentation
├── frontend/               # Next.js frontend
│   ├── src/app/            # Pages
│   ├── src/lib/api/        # API clients
│   └── src/lib/auth/       # Authentication
├── backend/                # FastAPI backend
│   ├── app/api/            # API endpoints
│   ├── app/models/         # Database models
│   ├── app/services/       # Business logic
│   └── migrations/         # Database migrations
├── storage/                # File storage (gitignored)
└── scripts/                # Utility scripts
```

## Documentation

| Document | Description |
|----------|-------------|
| [PRODUCTION-CHECKLIST.md](PRODUCTION-CHECKLIST.md) | Production deployment checklist |
| [REGISTRAR-WORKFLOW.md](REGISTRAR-WORKFLOW.md) | Complete registrar workflow |
| [OPERATIONS.md](OPERATIONS.md) | System operations guide |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and solutions |
| [SSO-INTEGRATION.md](SSO-INTEGRATION.md) | SSO integration guide |
| [CROWDMARK-INTEGRATION.md](CROWDMARK-INTEGRATION.md) | Crowdmark integration |
| [DATA-CLASSIFICATION.md](DATA-CLASSIFICATION.md) | Data classification |
| [AUTHORIZATION-MATRIX.md](AUTHORIZATION_MATRIX.md) | Authorization matrix |
| [PILOT-WORKFLOW.md](PILOT-WORKFLOW.md) | Pilot workflow |
| [PILOT-ACCEPTANCE.md](PILOT-ACCEPTANCE.md) | Pilot acceptance criteria |
| [SECURITY-REVIEW.md](SECURITY-REVIEW.md) | Security review report |
| [LIMITATIONS.md](LIMITATIONS.md) | Known limitations |
| [BACKLOG.md](BACKLOG.md) | Feature backlog |

## Development

### Running Tests

```bash
cd backend
pytest tests/ -v
```

### Linting

```bash
cd backend
ruff check app/
```

### Building Frontend

```bash
cd frontend
npm run build
```

## License

MIT License
