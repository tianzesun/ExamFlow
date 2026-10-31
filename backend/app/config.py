from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Environments where the built-in development sign-in may be switched on. Anything else
# ("production", "prod", "staging", a typo) is treated as a real deployment.
DEV_ENVIRONMENTS = frozenset({"development", "dev", "local", "test", "pilot"})


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str
    NEXT_PUBLIC_API_URL: str = "http://localhost:3000"
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 3000
    # Public base URL of the web app; printed in the QR code on each paper.
    PUBLIC_APP_URL: str = "http://localhost:3000"

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

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent.parent / ".env.local"),
        env_file_encoding="utf-8",
    )

    @property
    def database_url(self) -> str:
        # SQLAlchemy 2.1 maps a bare "postgresql://" to psycopg 3; we ship psycopg2.
        if self.DATABASE_URL.startswith("postgresql://"):
            return "postgresql+psycopg2://" + self.DATABASE_URL.removeprefix("postgresql://")
        return self.DATABASE_URL

    @property
    def is_dev_environment(self) -> bool:
        return self.APP_ENV.strip().lower() in DEV_ENVIRONMENTS

    @property
    def dev_auth_enabled(self) -> bool:
        """The well-known dev tokens sign in only when dev mode is on in a development environment."""
        return self.AUTH_DEV_MODE and self.is_dev_environment

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_production_settings() -> list[str]:
    settings = get_settings()
    errors = []

    if not settings.is_dev_environment:
        if settings.AUTH_DEV_MODE:
            errors.append(f"AUTH_DEV_MODE must be false outside development (APP_ENV={settings.APP_ENV!r})")
        if not settings.OIDC_ISSUER:
            errors.append("OIDC_ISSUER is required in production")
        if not settings.OIDC_CLIENT_ID:
            errors.append("OIDC_CLIENT_ID is required in production")
        if not settings.OIDC_CLIENT_SECRET:
            errors.append("OIDC_CLIENT_SECRET is required in production")
        if "localhost" in settings.CORS_ALLOWED_ORIGINS:
            errors.append("CORS_ALLOWED_ORIGINS should not contain localhost in production")

    return errors
