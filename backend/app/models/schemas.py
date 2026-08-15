"""Pydantic v2 response models — these define the public API contract.

The TypeScript interfaces in ``frontend/src/lib/types.ts`` mirror these
one-for-one; change them together.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RiskLevel = Literal["low", "moderate", "high"]
TrendDirection = Literal["increasing", "decreasing", "stable", "insufficient_data"]


class Percentiles(BaseModel):
    p10: float | None = None
    p25: float | None = None
    p50: float | None = None
    p75: float | None = None
    p90: float | None = None


class VariableStats(BaseModel):
    """Descriptive statistics over the sampled day-of-year window."""

    unit: str
    valid_count: int
    mean: float | None
    std: float | None
    min: float | None
    min_year: int | None
    max: float | None
    max_year: int | None
    percentiles: Percentiles


class Histogram(BaseModel):
    """Pre-binned distribution so the client never recomputes statistics."""

    bin_edges: list[float]
    counts: list[int]


class TrendPoint(BaseModel):
    year: int
    value: float = Field(description="Exceedance fraction (0–1) for this year's window.")
    samples: int


class Trend(BaseModel):
    """Linear regression of yearly exceedance fraction against year."""

    slope_per_decade: float | None
    direction: TrendDirection
    first_decade: float | None = None
    last_decade: float | None = None
    first_decade_label: str | None = None
    last_decade_label: str | None = None
    delta: float | None = None
    summary: str
    yearly: list[TrendPoint]


class ConditionResult(BaseModel):
    """One of the five adverse-condition questions."""

    key: str
    label: str
    variable: str
    description: str
    direction: Literal["above", "below"]
    threshold: float
    unit: str
    probability: float = Field(ge=0.0, le=1.0)
    percent: float
    risk_level: RiskLevel
    exceeding_samples: int
    valid_samples: int
    threshold_percentile: float | None
    threshold_context: str
    stats: VariableStats
    histogram: Histogram
    trend: Trend


class RainTier(BaseModel):
    key: str
    label: str
    threshold_mm: float
    probability: float
    percent: float
    exceeding_samples: int
    valid_samples: int
    risk_level: RiskLevel


class Summary(BaseModel):
    headline: str
    detail: str
    any_rain_percent: float
    heavy_rain_percent: float
    overall_risk_score: float
    overall_risk_level: RiskLevel
    dominant_risk: str
    dominant_risk_label: str
    dominant_risk_percent: float


class GridCell(BaseModel):
    """The POWER grid cell the request was actually snapped to."""

    lat: float
    lon: float
    requested_lat: float
    requested_lon: float
    resolution: str = "0.5° latitude × 0.625° longitude"


class Metadata(BaseModel):
    """Provenance travels with every response."""

    source: str = "NASA POWER / MERRA-2"
    source_project: str = (
        "Data obtained from the NASA Langley Research Center (LaRC) POWER Project"
    )
    grid_cell: GridCell
    start_year: int
    end_year: int
    years_covered: int
    target_month: int
    target_day: int
    window_days: int
    sample_size: int = Field(description="Window days actually present in the record.")
    expected_sample_size: int = Field(description="years × (2 × window + 1).")
    missing_days: int = Field(description="Window days absent from the POWER record.")
    fill_value_days: dict[str, int] = Field(
        description="Per-parameter count of -999 fill values inside the window."
    )
    units: dict[str, str]
    cache_hit: bool
    power_url_pattern: str
    generated_note: str = (
        "Climatology, not a forecast: these are historical likelihoods derived from "
        "NASA Earth observation data, not a prediction for a specific upcoming day."
    )


class ProbabilityResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    summary: Summary
    conditions: dict[str, ConditionResult]
    rain_tiers: list[RainTier]
    thresholds: dict[str, float]
    metadata: Metadata


class BestDay(BaseModel):
    day: int
    date_label: str
    risk_score: float
    risk_level: RiskLevel
    rank: int
    probabilities: dict[str, float]
    any_rain_probability: float


class BestDaysResponse(BaseModel):
    month: int
    month_name: str
    days: list[BestDay] = Field(description="Every day of the month, calendar order.")
    ranked: list[BestDay] = Field(description="Same days, best (lowest risk) first.")
    best_three: list[BestDay]
    thresholds: dict[str, float]
    metadata: Metadata


class HealthResponse(BaseModel):
    status: str
    version: str
    cache_entries: int
    cache_hits: int
    cache_misses: int


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    retry_after: int | None = None
