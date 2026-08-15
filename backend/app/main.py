"""orbitWx API — historical weather probabilities from NASA Earth observations.

Built for the NASA Space Apps Challenge 2025 challenge
"Will It Rain On My Parade?" by Team Coders.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.core.limiter import limiter
from app.routers import export, health, probability
from app.services.nasa_power import PowerUpstreamError, power_client

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
logger = logging.getLogger("orbitwx")

DESCRIPTION = """
**orbitWx** turns 30 years of NASA Earth observation data into
*"should I plan my outdoor event on this date?"* answers.

> **This is climatology, not a forecast.** Forecasts cover the next ~10 days.
> orbitWx answers a different question: *historically, what are the odds of
> very hot / very cold / very windy / very wet / very uncomfortable conditions
> at this location on this calendar date?*

**Data source:** NASA POWER Daily Point API (MERRA-2 assimilation model,
0.5° × 0.625° grid). Data obtained from the NASA Langley Research Center (LaRC)
POWER Project.
"""


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await power_client.startup()
    logger.info(
        "orbitWx API ready | climatology window %s–%s | origins=%s",
        settings.power_start_year,
        settings.power_end_year,
        settings.cors_origins,
    )
    try:
        yield
    finally:
        await power_client.shutdown()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=DESCRIPTION,
    lifespan=lifespan,
    contact={"name": "Team Coders — Het Patel", "url": "https://buildbyhet.me"},
    license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(PowerUpstreamError)
async def power_upstream_handler(_: Request, exc: PowerUpstreamError) -> JSONResponse:
    """Never leak a stack trace when NASA POWER is having a bad day."""
    logger.error("power.upstream_error %s", exc)
    return JSONResponse(
        status_code=503,
        content={
            "error": "NASA POWER upstream unavailable",
            "detail": str(exc),
            "retry_after": exc.retry_after,
        },
        headers={"Retry-After": str(exc.retry_after)},
    )


app.include_router(health.router)
app.include_router(probability.router)
app.include_router(export.router)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "note": "Climatology, not a forecast.",
    }
