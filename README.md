# ExamFlow

A university examination administration system designed to simplify examination preparation, seating assignment, and personalized exam document generation.

ExamFlow does not replace Crowdmark. ExamFlow simplifies the administrative work that happens around Crowdmark.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 |
| Database | PostgreSQL 16 |
| Migration | Alembic |
| Testing | pytest, Jest |
| Linting | Ruff, ESLint |

## Repository Structure

```
ExamFlow/
├── README.md
├── .gitignore
├── .env.example
├── .env.local
├── docker-compose.yml
├── doc/                    # Project documentation
├── prompts/                # Phase implementation prompts
├── frontend/               # Next.js frontend
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   └── api/
│   ├── migrations/
│   ├── tests/
│   └── pyproject.toml
├── storage/                # File storage
└── scripts/                # Utility scripts
```

## Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 16+ (or Neon cloud database)
- npm or pnpm

## Local Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd ExamFlow
```

### 2. Environment Configuration

Copy `.env.example` to `.env.local` and configure your database connection:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your database credentials.

### 3. Start Backend

```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Database Setup

```bash
cd backend
alembic upgrade head
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /docs | FastAPI documentation |

## Development

### Running Tests

Backend:
```bash
cd backend
pytest
```

Frontend:
```bash
cd frontend
npm test
```

### Linting

Backend:
```bash
cd backend
ruff check .
```

Frontend:
```bash
cd frontend
npm run lint
```

## Current Phase 0 Limitations

This is Phase 0 - Project Scaffolding. The following features have NOT been implemented yet:

- No exam management
- No student management
- No room/seat management
- No seating assignment
- No PDF generation
- No Crowdmark integration
- No authentication
- No authorization

## License

MIT License
