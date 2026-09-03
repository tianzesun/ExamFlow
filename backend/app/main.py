import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.admin import router as admin_router
from app.api.administration import router as administration_router
from app.api.assignments import router as assignments_router
from app.api.auth import router as auth_router
from app.api.courses import router as courses_router
from app.api.exams import router as exams_router
from app.api.pdf import router as pdf_router
from app.api.readiness import router as readiness_router
from app.api.rooms import router as rooms_router
from app.api.ttb import router as ttb_router
from app.api.roster import router as roster_router
from app.api.templates import router as templates_router
from app.config import get_settings, validate_production_settings
from app.database import SessionLocal

logger = logging.getLogger("examflow")

settings = get_settings()

# Production safety check
if settings.APP_ENV == "production" and settings.AUTH_DEV_MODE:
    raise RuntimeError(
        "AUTH_DEV_MODE cannot be enabled in production. "
        "Set AUTH_DEV_MODE=false in production environment."
    )

# Validate production settings at startup
prod_errors = validate_production_settings()
if prod_errors:
    for err in prod_errors:
        logger.warning("Production config: %s", err)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ExamFlow starting (env=%s)", settings.APP_ENV)
    yield
    logger.info("ExamFlow shutting down")


app = FastAPI(
    title="ExamFlow API",
    description="University examination administration platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.monotonic()

    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000, 1)

    response.headers["X-Request-Id"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    if settings.APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"

    # CSP - without unsafe-inline/unsafe-eval where possible
    csp_parts = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
    response.headers["Content-Security-Policy"] = "; ".join(csp_parts)

    # Structured log
    status_code = response.status_code
    path = request.url.path
    if not path.startswith("/health"):
        logger.info(
            "%s %s %s %sms request_id=%s",
            request.method, path, status_code, duration_ms, request_id,
        )

    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error("Unhandled error: %s path=%s request_id=%s", exc, request.url.path, request_id)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred. Please contact an administrator.",
            "request_id": request_id,
        },
    )


# Include routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(courses_router)
app.include_router(exams_router)
app.include_router(roster_router)
app.include_router(rooms_router)
app.include_router(assignments_router)
app.include_router(pdf_router)
app.include_router(templates_router)
app.include_router(administration_router)
app.include_router(readiness_router)
app.include_router(ttb_router)


@app.get("/health")
def health_check():
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception as e:
        logger.error("Health check DB failure: %s", e)

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": "0.1.0",
        "environment": settings.APP_ENV,
    }
