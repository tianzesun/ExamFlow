from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.courses import router as courses_router
from app.api.exams import router as exams_router
from app.api.roster import router as roster_router
from app.config import get_settings

settings = get_settings()

# Production safety check
if settings.APP_ENV == "production" and settings.AUTH_DEV_MODE:
    raise RuntimeError(
        "AUTH_DEV_MODE cannot be enabled in production. "
        "Set AUTH_DEV_MODE=false in production environment."
    )

app = FastAPI(
    title="ExamFlow API",
    description="University examination administration platform",
    version="0.1.0",
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
async def security_headers(request: Request, call_next):
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # CSP - basic policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'"
    )

    return response


# Include routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(courses_router)
app.include_router(exams_router)
app.include_router(roster_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
