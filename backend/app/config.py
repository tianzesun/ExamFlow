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
    # UTORid sign-in through the university's Microsoft Entra ID. The browser signs in with
    # MSAL and sends an Entra access token; there is no client secret and no ExamFlow session.
    ENTRA_TENANT_ID: str = ""
    # Application (client) ID of the ExamFlow app registration (single-page app exposing the API).
    ENTRA_CLIENT_ID: str = ""
    # Delegated scope the app registration exposes, under api://<client id>/.
    ENTRA_API_SCOPE: str = "access_as_user"
    # Entra app role value → ExamFlow role. Users need one of these roles assigned to sign in.
    ENTRA_ROLE_MAP: str = "ExamFlow.Admin=ADMIN,ExamFlow.Staff=STAFF,ExamFlow.Instructor=INSTRUCTOR,ExamFlow.TA=TA"
    # Unused since Entra sign-in; kept so existing env files still load.
    OIDC_ISSUER: str = ""
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""
    OIDC_REDIRECT_URI: str = ""

    # Guards against abuse on sign-in, uploads, paper generation and the QR check (app/rate_limit.py).
    RATE_LIMITS_ENABLED: bool = True

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
    def entra_enabled(self) -> bool:
        return bool(self.ENTRA_TENANT_ID.strip() and self.ENTRA_CLIENT_ID.strip())

    @property
    def entra_role_map(self) -> dict[str, str]:
        pairs = (item.split("=", 1) for item in self.ENTRA_ROLE_MAP.split(",") if "=" in item)
        return {k.strip(): v.strip().upper() for k, v in pairs if k.strip() and v.strip()}

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
        if not settings.entra_enabled:
            errors.append("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required in production (UTORid sign-in)")
        if "localhost" in settings.CORS_ALLOWED_ORIGINS:
            errors.append("CORS_ALLOWED_ORIGINS should not contain localhost in production")

    return errors
