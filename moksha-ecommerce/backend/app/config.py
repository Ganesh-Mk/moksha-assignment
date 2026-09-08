"""Application configuration.

Two rules drive the shape of this module:

1. **Fail loudly, never silently.** A missing secret must stop the process or fail the request
   with a message naming the variable. The failure mode this guards against is a webhook
   verifier that quietly disables itself when its signing secret is absent — which turns a
   security control into a no-op without anyone noticing.

2. **Phase-gated requirements.** Credentials arrive at different times. A variable is optional
   until the feature that needs it exists, then becomes required *of that feature only*: the
   API still boots, logs the feature as disabled, and returns 503 with the missing variable
   named if someone calls it. That is loud, and it keeps the rest of the app runnable.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# The repo root holds one .env shared by both assignments; this file is
# backend/app/config.py, so the root is three parents up.
_REPO_ROOT = Path(__file__).resolve().parents[3]
# Machine-specific overrides (a non-default database port, say) live next to the backend rather
# than in the shared root .env, so they cannot affect the other assignment's session.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]


class ConfigurationError(RuntimeError):
    """Raised when a feature is used without the configuration it requires."""

    def __init__(self, feature: str, missing: list[str]) -> None:
        self.feature = feature
        self.missing = missing
        names = ", ".join(missing)
        super().__init__(
            f"{feature} is not configured. Missing environment variable(s): {names}. "
            f"Copy .env.example to .env at the repository root and fill them in."
        )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Later files win, so a local override beats the shared root .env.
        env_file=(_REPO_ROOT / ".env", _BACKEND_ROOT / ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Core: required for the process to start at all ---------------------------------
    environment: Literal["local", "test", "production"] = "local"
    database_url: str = "postgresql+psycopg://moksha:moksha@localhost:5432/moksha"
    # A separate database for the suite. The oversell test needs real SELECT ... FOR UPDATE,
    # so tests run against Postgres — but never against the database holding the demo data.
    test_database_url: str | None = None
    # Optional DSN for migrations only, falling back to `database_url` when unset.
    #
    # Managed Postgres usually offers two endpoints: a pooled one (PgBouncer in transaction mode)
    # and a direct one. The pooled endpoint is right for the application — it is what keeps a
    # dozen instances from exhausting the connection limit — but it is the wrong place to run DDL:
    # a transaction pooler hands each transaction a different backend session, which is hostile to
    # long multi-statement migrations and to session-scoped state generally. Neon's own guidance is
    # to migrate over the direct endpoint.
    migration_database_url: str | None = None
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # --- Phase 2: Google Sign-In --------------------------------------------------------
    google_client_id: str | None = None

    # Password for the demo sign-in, which exists so the app can be *reviewed*.
    #
    # The Google consent screen is in Testing mode, so only allow-listed Google accounts can sign
    # in at all. Without this, a reviewer sees the public catalogue and nothing else — no
    # checkout, no orders, no AI agent, no admin. That is most of the assignment.
    #
    # Unset means the endpoint does not exist (404), so this is opt-in per deployment rather than
    # a door that is always ajar.
    demo_login_password: str | None = None

    # --- Phase 5: Stripe ----------------------------------------------------------------
    stripe_secret_key: str | None = None
    stripe_publishable_key: str | None = None
    stripe_webhook_secret: str | None = None

    # --- Phase 6: AI agent --------------------------------------------------------------
    anthropic_api_key: str | None = None
    agent_model: str = "claude-haiku-4-5-20251001"
    agent_max_steps: int = 6
    chat_rate_limit_per_minute: int = 12

    # --- URLs and roles -----------------------------------------------------------------
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    admin_emails_raw: str = Field(default="", alias="ADMIN_EMAILS")

    log_level: str = "INFO"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def admin_emails(self) -> frozenset[str]:
        """Emails granted the admin role on first sign-in.

        Lower-cased because Google returns the address in the case the user typed it, and an
        admin allowlist that is case-sensitive is an allowlist that silently fails.
        """
        return frozenset(e.strip().lower() for e in self.admin_emails_raw.split(",") if e.strip())

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> list[str]:
        return [self.frontend_url, "http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    # --- Feature gates ------------------------------------------------------------------
    # Each returns the config a feature needs, or raises naming exactly what is missing.
    # Call these at the point of use so the error lands in a request, not at import time.

    def require_google(self) -> str:
        if not self.google_client_id:
            raise ConfigurationError("Google Sign-In", ["GOOGLE_CLIENT_ID"])
        return self.google_client_id

    def require_stripe(self) -> tuple[str, str]:
        missing = [
            name
            for name, value in (
                ("STRIPE_SECRET_KEY", self.stripe_secret_key),
                ("STRIPE_WEBHOOK_SECRET", self.stripe_webhook_secret),
            )
            if not value
        ]
        if missing:
            raise ConfigurationError("Stripe payments", missing)
        assert self.stripe_secret_key and self.stripe_webhook_secret  # narrowed by the check
        return self.stripe_secret_key, self.stripe_webhook_secret

    def require_demo_login(self) -> str:
        if not self.demo_login_password:
            raise ConfigurationError("Demo sign-in", ["DEMO_LOGIN_PASSWORD"])
        return self.demo_login_password

    @property
    def demo_login_enabled(self) -> bool:
        return bool(self.demo_login_password)

    def require_anthropic(self) -> str:
        if not self.anthropic_api_key:
            raise ConfigurationError("AI support agent", ["ANTHROPIC_API_KEY"])
        return self.anthropic_api_key

    def feature_status(self) -> dict[str, str]:
        """Boot-time report. Printed once so a disabled feature is visible, never assumed."""

        def status(*pairs: tuple[str, str | None]) -> str:
            missing = [name for name, value in pairs if not value]
            return "enabled" if not missing else f"DISABLED (missing {', '.join(missing)})"

        return {
            "google_sign_in": status(("GOOGLE_CLIENT_ID", self.google_client_id)),
            "stripe_payments": status(
                ("STRIPE_SECRET_KEY", self.stripe_secret_key),
                ("STRIPE_WEBHOOK_SECRET", self.stripe_webhook_secret),
            ),
            "ai_agent": status(("ANTHROPIC_API_KEY", self.anthropic_api_key)),
            # Reported so it is obvious from outside whether the demo door is open.
            "demo_login": "enabled" if self.demo_login_enabled else "disabled",
        }

    def assert_production_ready(self) -> None:
        """Production has no phase-gating: every credential must be present and real.

        Refusing to boot is the correct behaviour here. A production deployment that comes up
        with Stripe disabled looks healthy to the load balancer and takes orders it cannot charge.
        """
        missing: list[str] = []
        if not self.google_client_id:
            missing.append("GOOGLE_CLIENT_ID")
        if not self.stripe_secret_key:
            missing.append("STRIPE_SECRET_KEY")
        if not self.stripe_webhook_secret:
            missing.append("STRIPE_WEBHOOK_SECRET")
        if not self.anthropic_api_key:
            missing.append("ANTHROPIC_API_KEY")
        if self.jwt_secret == "dev-only-insecure-secret-change-me":
            missing.append("JWT_SECRET (still the development placeholder)")
        if missing:
            raise ConfigurationError("Production startup", missing)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
