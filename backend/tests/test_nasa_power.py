"""POWER client: grid snapping, decade chunking, caching, retries.

Every request is served by an ``httpx.MockTransport`` — the real NASA POWER API
is never contacted from the test suite.
"""

from __future__ import annotations

import asyncio

import httpx
import numpy as np
import pytest

from app.core.cache import TTLCache
from app.services.nasa_power import (
    NasaPowerClient,
    PowerUpstreamError,
    _decade_chunks,
    cache_key,
    snap_to_grid,
)

# --------------------------------------------------------------------------- #
# Grid + chunking helpers
# --------------------------------------------------------------------------- #


def test_snap_to_grid_uses_merra2_resolution() -> None:
    # Ahmedabad -> the 0.5 x 0.625 cell that POWER actually serves.
    assert snap_to_grid(23.0331, 72.5850) == (23.0, 72.5)
    assert snap_to_grid(0.24, 0.40) == (0.0, 0.625)
    assert snap_to_grid(-33.87, 151.21) == (-34.0, 151.25)


def test_nearby_points_share_a_cache_key() -> None:
    """Two searches inside the same city must reuse one upstream fetch."""
    assert cache_key(23.03, 72.58, 1996, 2025) == cache_key(23.05, 72.60, 1996, 2025)
    assert cache_key(23.03, 72.58, 1996, 2025) != cache_key(28.61, 77.20, 1996, 2025)


def test_decade_chunks_split_thirty_years() -> None:
    assert _decade_chunks(1996, 2025) == [(1996, 2005), (2006, 2015), (2016, 2025)]
    assert _decade_chunks(2000, 2004) == [(2000, 2004)]


def test_ttl_cache_evicts_least_recently_used() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, max_entries=2)
    cache.set("a", "1")
    cache.set("b", "2")
    cache.get("a")  # 'a' becomes most-recently used
    cache.set("c", "3")

    assert cache.get("b") is None
    assert cache.get("a") == "1"
    assert cache.get("c") == "3"


def test_ttl_cache_expires_entries() -> None:
    cache: TTLCache[str] = TTLCache(ttl_seconds=0, max_entries=5)
    cache.set("a", "1")
    assert cache.get("a") is None


# --------------------------------------------------------------------------- #
# Mocked upstream
# --------------------------------------------------------------------------- #


def _chunk_payload(start_year: int, end_year: int) -> dict[str, object]:
    """A minimal POWER-shaped body: Jan 1 of each year in the chunk."""
    parameters: dict[str, dict[str, float]] = {}
    for param in (
        "T2M",
        "T2M_MAX",
        "T2M_MIN",
        "PRECTOTCORR",
        "WS10M",
        "WS2M",
        "RH2M",
        "T2MDEW",
    ):
        parameters[param] = {
            f"{year}0101": (-999.0 if year == start_year else 20.0)
            for year in range(start_year, end_year + 1)
        }
    return {"properties": {"parameter": parameters}}


def _mock_client(handler) -> NasaPowerClient:
    client = NasaPowerClient()
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return client


@pytest.mark.asyncio
async def test_fetches_three_decade_chunks_and_merges_them() -> None:
    seen: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        start = request.url.params["start"]
        end = request.url.params["end"]
        seen.append((start, end))
        return httpx.Response(200, json=_chunk_payload(int(start[:4]), int(end[:4])))

    client = _mock_client(handler)
    series, cache_hit = await client.get_series(23.0331, 72.5850, 1996, 2025)

    assert sorted(seen) == [
        ("19960101", "20051231"),
        ("20060101", "20151231"),
        ("20160101", "20251231"),
    ]
    assert cache_hit is False
    assert series.total_days == 30  # one day per year across the merged chunks
    assert series.grid_lat == 23.0 and series.grid_lon == 72.5

    # The -999 entries (first year of each chunk) became NaN.
    assert series.missing_counts["T2M"] == 3
    assert np.isnan(series.values["T2M"][0])

    await client._client.aclose()


@pytest.mark.asyncio
async def test_second_request_in_the_same_cell_hits_cache() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        start = int(request.url.params["start"][:4])
        end = int(request.url.params["end"][:4])
        return httpx.Response(200, json=_chunk_payload(start, end))

    client = _mock_client(handler)
    await client.get_series(23.0331, 72.5850, 1996, 2025)
    assert calls == 3

    _, cache_hit = await client.get_series(23.05, 72.60, 1996, 2025)  # same grid cell
    assert cache_hit is True
    assert calls == 3  # no additional upstream traffic

    await client._client.aclose()


@pytest.mark.asyncio
async def test_server_errors_retry_then_raise(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503, text="upstream down")

    real_sleep = asyncio.sleep
    monkeypatch.setattr(asyncio, "sleep", lambda _: real_sleep(0))
    client = _mock_client(handler)

    with pytest.raises(PowerUpstreamError) as excinfo:
        await client.get_series(23.0, 72.5, 2020, 2020)

    assert attempts == 3  # initial call + 2 retries
    assert excinfo.value.retry_after == 60

    await client._client.aclose()


@pytest.mark.asyncio
async def test_transient_failure_is_retried_successfully(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(500, text="hiccup")
        return httpx.Response(200, json=_chunk_payload(2020, 2020))

    real_sleep = asyncio.sleep
    monkeypatch.setattr(asyncio, "sleep", lambda _: real_sleep(0))
    client = _mock_client(handler)

    series, _ = await client.get_series(23.0, 72.5, 2020, 2020)
    assert attempts == 2
    assert series.total_days == 1

    await client._client.aclose()


@pytest.mark.asyncio
async def test_empty_parameter_block_is_an_upstream_error() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"properties": {"parameter": {}}})

    client = _mock_client(handler)
    with pytest.raises(PowerUpstreamError):
        await client.get_series(23.0, 72.5, 2020, 2020)

    await client._client.aclose()
