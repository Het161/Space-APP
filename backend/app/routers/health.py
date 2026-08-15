"""Liveness endpoint — also used by Render's health check and uptime pings."""

from fastapi import APIRouter

from app.config import settings
from app.models.schemas import HealthResponse
from app.services.nasa_power import power_client

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="Service health")
async def health() -> HealthResponse:
    stats = power_client.cache.stats
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        cache_entries=stats["entries"],
        cache_hits=stats["hits"],
        cache_misses=stats["misses"],
    )
