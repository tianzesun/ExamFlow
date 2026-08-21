from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str
    NEXT_PUBLIC_API_URL: str = "http://localhost:3000"
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 3000

    # Authentication
    AUTH_DEV_MODE: bool = True
    OIDC_ISSUER: str = ""
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""
    OIDC_REDIRECT_URI: str = "http://localhost:3000/auth/callback"

    # CORS
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Storage
    STORAGE_TYPE: str = "local"
    STORAGE_PATH: str = "./storage"

    # Crowdmark (Future)
    CROWDMARK_API_URL: str = ""
    CROWDMARK_API_KEY: str = ""

    class Config:
        env_file = str(Path(__file__).parent.parent.parent / ".env.local")
        env_file_encoding = "utf-8"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
