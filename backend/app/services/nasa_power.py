"""NASA POWER Daily Point API client.

Data provenance: NASA Langley Research Center (LaRC) POWER Project, which
serves daily meteorology derived from NASA's MERRA-2 assimilation model on a
0.5° x 0.625° latitude/longitude grid from 1981-01-01 to near-present. No API
key is required.

Three implementation details matter for performance and correctness:

1. **Decade chunking.** A single 30-year request works but is slow; splitting
   the range into decades and issuing them concurrently cuts latency ~3x.
2. **Grid-cell caching.** POWER snaps every request to its native grid, so two
   searches inside the same city resolve to the same cell. We cache on the
   rounded cell, not the raw coordinates.
3. **Fill values.** Missing observations come back as -999 and must be excluded
   from every statistic (and counted, so provenance travels with the answer).
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import date, datetime

import httpx
import numpy as np
from numpy.typing import NDArray

from app.config import settings
from app.core.cache import TTLCache

logger = logging.getLogger("orbitwx.power")

#: Parameters requested from POWER. Order is irrelevant to the API but kept
#: stable so cache keys and exports are deterministic.
POWER_PARAMETERS: tuple[str, ...] = (
    "T2M",  # mean air temperature at 2 m (°C)
    "T2M_MAX",  # daily maximum air temperature at 2 m (°C)
    "T2M_MIN",  # daily minimum air temperature at 2 m (°C)
    "PRECTOTCORR",  # bias-corrected total precipitation (mm/day)
    "WS10M",  # wind speed at 10 m (m/s)
    "WS2M",  # wind speed at 2 m (m/s)
    "RH2M",  # relative humidity at 2 m (%)
    "T2MDEW",  # dew point at 2 m (°C)
)

PARAMETER_UNITS: dict[str, str] = {
    "T2M": "°C",
    "T2M_MAX": "°C",
    "T2M_MIN": "°C",
    "PRECTOTCORR": "mm/day",
    "WS10M": "m/s",
    "WS2M": "m/s",
    "RH2M": "%",
    "T2MDEW": "°C",
    "HEAT_INDEX": "°C",
}

#: POWER's fill value for a missing observation.
FILL_VALUE = -999.0

#: Native MERRA-2 grid spacing used by POWER.
GRID_LAT_STEP = 0.5
GRID_LON_STEP = 0.625

#: Documented in every API response so consumers can reproduce the fetch.
POWER_URL_PATTERN = (
    f"{settings.power_base_url}"
    "?parameters={parameters}&community=RE"
    "&longitude={lon}&latitude={lat}&start={start}&end={end}&format=JSON"
)


class PowerUpstreamError(RuntimeError):
    """Raised when NASA POWER cannot be reached or returns an unusable body."""

    def __init__(self, message: str, retry_after: int = 60) -> None:
        super().__init__(message)
        self.retry_after = retry_after


def snap_to_grid(lat: float, lon: float) -> tuple[float, float]:
    """Snap a coordinate onto the POWER 0.5° x 0.625° grid.

    Returns the cell centre used both as the cache key and as the
    ``grid_cell`` reported back to the user.
    """
    grid_lat = round(round(lat / GRID_LAT_STEP) * GRID_LAT_STEP, 4)
    grid_lon = round(round(lon / GRID_LON_STEP) * GRID_LON_STEP, 4)
    # Guard against rounding pushing us off the valid domain at the poles /
    # antimeridian.
    grid_lat = max(-90.0, min(90.0, grid_lat))
    if grid_lon > 180.0:
        grid_lon -= 360.0
    elif grid_lon < -180.0:
        grid_lon += 360.0
    return grid_lat, grid_lon


def cache_key(lat: float, lon: float, start_year: int, end_year: int) -> str:
    grid_lat, grid_lon = snap_to_grid(lat, lon)
    return f"{grid_lat:.4f}:{grid_lon:.4f}:{start_year}:{end_year}"


@dataclass(slots=True)
class PowerSeries:
    """A parsed, NaN-cleaned daily time series for one grid cell."""

    grid_lat: float
    grid_lon: float
    start_year: int
    end_year: int
    dates: list[date]
    values: dict[str, NDArray[np.float64]]
    missing_counts: dict[str, int] = field(default_factory=dict)
    _index: dict[date, int] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        if not self._index:
            self._index = {d: i for i, d in enumerate(self.dates)}

    def index_of(self, day: date) -> int | None:
        return self._index.get(day)

    @property
    def total_days(self) -> int:
        return len(self.dates)


def _decade_chunks(start_year: int, end_year: int, size: int = 10) -> list[tuple[int, int]]:
    """Split an inclusive year range into chunks of at most ``size`` years."""
    chunks: list[tuple[int, int]] = []
    year = start_year
    while year <= end_year:
        chunk_end = min(year + size - 1, end_year)
        chunks.append((year, chunk_end))
        year = chunk_end + 1
    return chunks


def _build_url(lat: float, lon: float, start_year: int, end_year: int) -> tuple[str, dict[str, str]]:
    params = {
        "parameters": ",".join(POWER_PARAMETERS),
        "community": settings.power_community,
        "longitude": f"{lon}",
        "latitude": f"{lat}",
        "start": f"{start_year}0101",
        "end": f"{end_year}1231",
        "format": "JSON",
    }
    return settings.power_base_url, params


class NasaPowerClient:
    """Async POWER client with retries, decade chunking and a grid-cell cache."""

    def __init__(self) -> None:
        self.cache: TTLCache[PowerSeries] = TTLCache(
            ttl_seconds=settings.cache_ttl_seconds,
            max_entries=settings.cache_max_entries,
        )
        self._client: httpx.AsyncClient | None = None
        # One in-flight fetch per grid cell: concurrent requests for the same
        # city wait on the same upstream call instead of stampeding POWER.
        self._locks: dict[str, asyncio.Lock] = {}

    async def startup(self) -> None:
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.power_timeout_seconds),
            headers={"User-Agent": "orbitWx/1.0 (NASA Space Apps 2025; Team Coders)"},
        )

    async def shutdown(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _require_client(self) -> httpx.AsyncClient:
        if self._client is None:  # pragma: no cover - lifespan guarantees this
            raise RuntimeError("NasaPowerClient used before startup()")
        return self._client

    async def _fetch_chunk(
        self, lat: float, lon: float, start_year: int, end_year: int
    ) -> dict[str, dict[str, float]]:
        """Fetch one decade and return ``{PARAM: {YYYYMMDD: value}}``."""
        url, params = _build_url(lat, lon, start_year, end_year)
        client = self._require_client()
        last_error: Exception | None = None

        for attempt in range(settings.power_max_retries + 1):
            try:
                started = time.perf_counter()
                response = await client.get(url, params=params)
                elapsed_ms = (time.perf_counter() - started) * 1000

                if response.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"POWER returned {response.status_code}",
                        request=response.request,
                        response=response,
                    )
                if response.status_code != 200:
                    raise PowerUpstreamError(
                        f"NASA POWER rejected the request ({response.status_code})"
                    )

                payload = response.json()
                parameters = payload.get("properties", {}).get("parameter")
                if not isinstance(parameters, dict) or not parameters:
                    raise PowerUpstreamError("NASA POWER returned no parameter data")

                logger.info(
                    "power.fetch chunk=%s-%s cell=(%.4f, %.4f) ms=%.0f attempt=%d",
                    start_year,
                    end_year,
                    lat,
                    lon,
                    elapsed_ms,
                    attempt + 1,
                )
                return parameters

            except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
                if attempt < settings.power_max_retries:
                    backoff = 2.0**attempt
                    logger.warning(
                        "power.retry chunk=%s-%s attempt=%d error=%s backoff=%.1fs",
                        start_year,
                        end_year,
                        attempt + 1,
                        exc,
                        backoff,
                    )
                    await asyncio.sleep(backoff)
                    continue
            except ValueError as exc:  # malformed JSON
                last_error = exc
                break

        raise PowerUpstreamError(
            f"NASA POWER upstream unavailable ({type(last_error).__name__})", retry_after=60
        )

    @staticmethod
    def _parse(
        chunks: list[dict[str, dict[str, float]]],
        grid_lat: float,
        grid_lon: float,
        start_year: int,
        end_year: int,
    ) -> PowerSeries:
        """Merge decade chunks into aligned NaN-cleaned numpy arrays."""
        merged: dict[str, dict[str, float]] = {param: {} for param in POWER_PARAMETERS}
        for chunk in chunks:
            for param, series in chunk.items():
                if param in merged and isinstance(series, dict):
                    merged[param].update(series)

        all_keys: set[str] = set()
        for series in merged.values():
            all_keys.update(series.keys())

        dates: list[date] = []
        for key in sorted(all_keys):
            try:
                dates.append(datetime.strptime(key, "%Y%m%d").date())
            except ValueError:  # pragma: no cover - POWER keys are well-formed
                continue

        if not dates:
            raise PowerUpstreamError("NASA POWER returned an empty time series")

        date_keys = [d.strftime("%Y%m%d") for d in dates]
        values: dict[str, NDArray[np.float64]] = {}
        missing_counts: dict[str, int] = {}

        for param in POWER_PARAMETERS:
            series = merged[param]
            column = np.array(
                [series.get(key, FILL_VALUE) for key in date_keys], dtype=np.float64
            )
            invalid = column <= FILL_VALUE + 1.0  # -999 (and any sentinel near it)
            column[invalid] = np.nan
            values[param] = column
            missing_counts[param] = int(invalid.sum())

        return PowerSeries(
            grid_lat=grid_lat,
            grid_lon=grid_lon,
            start_year=start_year,
            end_year=end_year,
            dates=dates,
            values=values,
            missing_counts=missing_counts,
        )

    async def get_series(
        self,
        lat: float,
        lon: float,
        start_year: int | None = None,
        end_year: int | None = None,
    ) -> tuple[PowerSeries, bool]:
        """Return the daily series for the grid cell containing ``lat``/``lon``.

        The boolean is ``True`` when the result came from cache.
        """
        start_year = start_year or settings.power_start_year
        end_year = end_year or settings.power_end_year
        grid_lat, grid_lon = snap_to_grid(lat, lon)
        key = cache_key(lat, lon, start_year, end_year)

        cached = self.cache.get(key)
        if cached is not None:
            logger.info("power.cache hit cell=(%.4f, %.4f)", grid_lat, grid_lon)
            return cached, True

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            # Another coroutine may have populated the cache while we waited.
            cached = self.cache.get(key)
            if cached is not None:
                return cached, True

            chunk_ranges = _decade_chunks(start_year, end_year)
            started = time.perf_counter()
            chunks = await asyncio.gather(
                *(
                    self._fetch_chunk(grid_lat, grid_lon, chunk_start, chunk_end)
                    for chunk_start, chunk_end in chunk_ranges
                )
            )
            series = self._parse(list(chunks), grid_lat, grid_lon, start_year, end_year)
            self.cache.set(key, series)

            logger.info(
                "power.cache miss cell=(%.4f, %.4f) chunks=%d days=%d ms=%.0f",
                grid_lat,
                grid_lon,
                len(chunk_ranges),
                series.total_days,
                (time.perf_counter() - started) * 1000,
            )
            return series, False


#: Module-level singleton wired into the FastAPI lifespan.
power_client = NasaPowerClient()
