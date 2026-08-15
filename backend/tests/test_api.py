"""Endpoint contract tests. The POWER client is stubbed out entirely."""

from __future__ import annotations

from datetime import date
from typing import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import nasa_power
from tests.conftest import build_series


def _generator(d: date) -> dict[str, float | None]:
    return {
        "T2M": 25.0,
        "T2M_MAX": 40.0 if d.day % 2 == 0 else 30.0,
        "T2M_MIN": 2.0 if d.month == 1 else 20.0,
        "PRECTOTCORR": 20.0 if d.day % 2 == 0 else 0.0,
        "WS10M": 12.0 if d.day % 5 == 0 else 3.0,
        "WS2M": 2.0,
        "RH2M": 60.0,
        "T2MDEW": 15.0,
    }


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    series = build_series(1996, 2025, _generator)

    async def fake_get_series(lat: float, lon: float, *_args, **_kwargs):
        return series, False

    monkeypatch.setattr(nasa_power.power_client, "get_series", fake_get_series)
    # Rate limiting is exercised separately; keep it out of the contract tests.
    app.state.limiter.enabled = False
    with TestClient(app) as test_client:
        yield test_client
    app.state.limiter.enabled = True


# --------------------------------------------------------------------------- #
# /health
# --------------------------------------------------------------------------- #


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "cache_entries" in body


# --------------------------------------------------------------------------- #
# /api/v1/probability
# --------------------------------------------------------------------------- #


def test_probability_returns_all_five_conditions(client: TestClient) -> None:
    response = client.get(
        "/api/v1/probability", params={"lat": 23.03, "lon": 72.58, "month": 6, "day": 15}
    )
    assert response.status_code == 200
    body = response.json()

    assert set(body["conditions"]) == {
        "very_hot",
        "very_cold",
        "very_windy",
        "very_wet",
        "very_uncomfortable",
    }
    wet = body["conditions"]["very_wet"]
    assert wet["percent"] == pytest.approx(53.3, abs=0.2)
    assert wet["threshold"] == 10.0
    assert wet["unit"] == "mm/day"
    assert len(wet["histogram"]["bin_edges"]) == len(wet["histogram"]["counts"]) + 1
    assert wet["trend"]["direction"] in {"increasing", "decreasing", "stable"}
    assert wet["threshold_percentile"] is not None
    assert "percentile" in wet["threshold_context"]

    assert [t["key"] for t in body["rain_tiers"]] == [
        "any_rain",
        "moderate_rain",
        "heavy_rain",
    ]
    assert body["summary"]["headline"].endswith("chance of rain on your parade")
    assert body["thresholds"]["very_hot"] == 35.0


def test_probability_metadata_carries_provenance(client: TestClient) -> None:
    response = client.get(
        "/api/v1/probability", params={"lat": 23.03, "lon": 72.58, "month": 6, "day": 15}
    )
    metadata = response.json()["metadata"]

    assert metadata["source"] == "NASA POWER / MERRA-2"
    assert "LaRC" in metadata["source_project"]
    assert metadata["years_covered"] == 30
    assert metadata["sample_size"] == 450  # 15 days x 30 years
    assert metadata["window_days"] == 7
    assert metadata["grid_cell"]["resolution"].startswith("0.5")
    assert "power.larc.nasa.gov" in metadata["power_url_pattern"]
    assert "not a forecast" in metadata["generated_note"]


def test_probability_honours_threshold_overrides(client: TestClient) -> None:
    response = client.get(
        "/api/v1/probability",
        params={
            "lat": 23.03,
            "lon": 72.58,
            "month": 6,
            "day": 15,
            "hot_threshold": 45,
            "wet_threshold": 25,
        },
    )
    body = response.json()
    assert body["conditions"]["very_hot"]["threshold"] == 45.0
    assert body["conditions"]["very_hot"]["probability"] == 0.0
    assert body["conditions"]["very_wet"]["probability"] == 0.0
    assert body["conditions"]["very_windy"]["threshold"] == 10.0  # untouched default


def test_probability_window_changes_sample_size(client: TestClient) -> None:
    response = client.get(
        "/api/v1/probability",
        params={"lat": 23.03, "lon": 72.58, "month": 6, "day": 15, "window": 1},
    )
    assert response.json()["metadata"]["sample_size"] == 90  # 3 days x 30 years


@pytest.mark.parametrize(
    "params",
    [
        {"lat": 23.03, "lon": 72.58, "month": 2, "day": 31},
        {"lat": 23.03, "lon": 72.58, "month": 4, "day": 31},
    ],
)
def test_impossible_dates_are_rejected(client: TestClient, params: dict[str, float]) -> None:
    response = client.get("/api/v1/probability", params=params)
    assert response.status_code == 422
    assert "not a valid calendar date" in response.json()["detail"]


def test_leap_day_is_accepted(client: TestClient) -> None:
    response = client.get(
        "/api/v1/probability", params={"lat": 23.03, "lon": 72.58, "month": 2, "day": 29}
    )
    assert response.status_code == 200


@pytest.mark.parametrize(
    "params",
    [
        {"lat": 120, "lon": 0, "month": 1, "day": 1},
        {"lat": 0, "lon": 200, "month": 1, "day": 1},
        {"lat": 0, "lon": 0, "month": 13, "day": 1},
        {"lat": 0, "lon": 0, "month": 1, "day": 1, "window": 40},
        {"lon": 0, "month": 1, "day": 1},
    ],
)
def test_out_of_range_inputs_are_rejected(
    client: TestClient, params: dict[str, float]
) -> None:
    assert client.get("/api/v1/probability", params=params).status_code == 422


# --------------------------------------------------------------------------- #
# /api/v1/export
# --------------------------------------------------------------------------- #


def test_csv_export_has_attribution_header_and_rows(client: TestClient) -> None:
    response = client.get(
        "/api/v1/export",
        params={"lat": 23.03, "lon": 72.58, "month": 6, "day": 15, "format": "csv"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    assert "orbitwx_23.03_72.58_6-15.csv" in response.headers["content-disposition"]

    lines = response.text.splitlines()
    comments = [line for line in lines if line.startswith("#")]
    assert any("NASA POWER" in c for c in comments)
    assert any("LaRC" in c for c in comments)
    assert any("power.larc.nasa.gov" in c for c in comments)

    header = next(line for line in lines if not line.startswith("#"))
    assert header.split(",") == [
        "date",
        "year",
        "T2M",
        "T2M_MAX",
        "T2M_MIN",
        "PRECTOTCORR",
        "WS10M",
        "RH2M",
        "heat_index",
    ]
    data_rows = [line for line in lines if line and not line.startswith("#")][1:]
    assert len(data_rows) == 450


def test_json_export_carries_metadata(client: TestClient) -> None:
    response = client.get(
        "/api/v1/export",
        params={"lat": 23.03, "lon": 72.58, "month": 6, "day": 15, "format": "json"},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["row_count"] == 450
    assert len(body["rows"]) == 450
    assert body["metadata"]["source"] == "NASA POWER / MERRA-2"
    assert body["rows"][0]["date"].startswith("1996-06")
    assert body["rows"][0]["heat_index"] is not None
    assert "orbitwx_23.03_72.58_6-15.json" in response.headers["content-disposition"]


def test_export_rejects_unknown_format(client: TestClient) -> None:
    response = client.get(
        "/api/v1/export",
        params={"lat": 23.03, "lon": 72.58, "month": 6, "day": 15, "format": "xlsx"},
    )
    assert response.status_code == 422


# --------------------------------------------------------------------------- #
# /api/v1/best-days
# --------------------------------------------------------------------------- #


def test_best_days_ranks_every_day_of_the_month(client: TestClient) -> None:
    response = client.get(
        "/api/v1/best-days", params={"lat": 23.03, "lon": 72.58, "month": 6}
    )
    assert response.status_code == 200
    body = response.json()

    assert body["month_name"] == "June"
    assert len(body["days"]) == 30
    assert [d["day"] for d in body["days"]] == list(range(1, 31))

    ranks = [d["rank"] for d in body["ranked"]]
    assert ranks == list(range(1, 31))
    scores = [d["risk_score"] for d in body["ranked"]]
    assert scores == sorted(scores)
    assert body["best_three"] == body["ranked"][:3]
    assert body["best_three"][0]["risk_score"] <= body["ranked"][-1]["risk_score"]


def test_best_days_february_offers_twenty_nine_candidates(client: TestClient) -> None:
    response = client.get(
        "/api/v1/best-days", params={"lat": 23.03, "lon": 72.58, "month": 2}
    )
    assert len(response.json()["days"]) == 29


# --------------------------------------------------------------------------- #
# Failure handling
# --------------------------------------------------------------------------- #


def test_upstream_outage_returns_clean_503(monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_get_series(*_args, **_kwargs):
        raise nasa_power.PowerUpstreamError("NASA POWER upstream unavailable", retry_after=42)

    monkeypatch.setattr(nasa_power.power_client, "get_series", failing_get_series)
    app.state.limiter.enabled = False

    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.get(
            "/api/v1/probability", params={"lat": 23.03, "lon": 72.58, "month": 6, "day": 15}
        )

    app.state.limiter.enabled = True
    assert response.status_code == 503
    body = response.json()
    assert body["error"] == "NASA POWER upstream unavailable"
    assert body["retry_after"] == 42
    assert "Traceback" not in response.text
