"""Application configuration, sourced from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the orbitWx backend.

    Every value can be overridden with an environment variable of the same
    (case-insensitive) name, or via a local ``.env`` file during development.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- app ---
    app_name: str = "orbitWx API"
    app_version: str = "1.0.0"
    debug: bool = False

    # --- CORS ---
    # Comma-separated list, e.g. "http://localhost:3000,https://orbitwx.vercel.app"
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- NASA POWER climatology window ---
    # 1996-01-01 .. 2025-12-31 == exactly 30 full calendar years.
    power_start_year: int = 1996
    power_end_year: int = 2025

    power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"
    power_community: str = "RE"
    power_timeout_seconds: float = 60.0
    power_max_retries: int = 2

    # --- cache ---
    cache_ttl_seconds: int = 60 * 60 * 24  # 24 hours
    cache_max_entries: int = 50

    # --- rate limiting ---
    # Each dashboard analysis costs two requests (/probability + /best-days),
    # so this is ~30 analyses per minute per IP. Repeat queries in the same
    # grid cell are cache hits and never reach NASA POWER.
    rate_limit: str = "60/minute"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def year_span(self) -> int:
        return self.power_end_year - self.power_start_year + 1


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton (also usable as a FastAPI dependency)."""
    return Settings()


settings = get_settings()
