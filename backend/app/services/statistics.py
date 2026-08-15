"""The orbitWx probability engine.

Everything here is *climatology*, not forecasting. For a target calendar date we
gather every observation inside a +/- N day-of-year window across 30 years of
NASA POWER records and report **empirical exceedance probabilities** — the
fraction of those historical days that breached a threshold — plus the
distribution, the location-relative percentile of the threshold, and a
year-over-year regression that exposes how the odds are shifting.
"""

from __future__ import annotations

import calendar
import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal, Sequence

import numpy as np
from numpy.typing import NDArray

from app.services.comfort import heat_index_celsius
from app.services.nasa_power import (
    PARAMETER_UNITS,
    POWER_PARAMETERS,
    POWER_URL_PATTERN,
    PowerSeries,
)

Direction = Literal["above", "below"]

#: Derived variable name used alongside the raw POWER parameters.
HEAT_INDEX = "HEAT_INDEX"

#: Number of histogram bins returned for the frontend distribution charts.
HISTOGRAM_BINS = 14


@dataclass(frozen=True, slots=True)
class ConditionSpec:
    """Definition of one of the five "adverse condition" questions."""

    key: str
    label: str
    variable: str
    direction: Direction
    default_threshold: float
    unit: str
    description: str
    #: Plain-English name of the underlying measurement, used in prose.
    metric_label: str


CONDITIONS: tuple[ConditionSpec, ...] = (
    ConditionSpec(
        key="very_hot",
        label="Very Hot",
        variable="T2M_MAX",
        direction="above",
        default_threshold=35.0,
        unit="°C",
        description="Daily maximum air temperature above the threshold.",
        metric_label="daily maximum temperatures",
    ),
    ConditionSpec(
        key="very_cold",
        label="Very Cold",
        variable="T2M_MIN",
        direction="below",
        default_threshold=5.0,
        unit="°C",
        description="Daily minimum air temperature below the threshold.",
        metric_label="daily minimum temperatures",
    ),
    ConditionSpec(
        key="very_windy",
        label="Very Windy",
        variable="WS10M",
        direction="above",
        default_threshold=10.0,
        unit="m/s",
        description="Wind speed at 10 m above the threshold.",
        metric_label="10 m wind speeds",
    ),
    ConditionSpec(
        key="very_wet",
        label="Very Wet",
        variable="PRECTOTCORR",
        direction="above",
        default_threshold=10.0,
        unit="mm/day",
        description="Bias-corrected daily precipitation above the threshold.",
        metric_label="daily rainfall totals",
    ),
    ConditionSpec(
        key="very_uncomfortable",
        label="Very Uncomfortable",
        variable=HEAT_INDEX,
        direction="above",
        default_threshold=40.0,
        unit="°C",
        description="NOAA heat index (temperature + humidity) above the threshold.",
        metric_label="heat index values",
    ),
)

CONDITIONS_BY_KEY: dict[str, ConditionSpec] = {c.key: c for c in CONDITIONS}

#: Weights for the combined "how risky is this day overall" score.
RISK_WEIGHTS: dict[str, float] = {
    "very_wet": 0.35,
    "very_hot": 0.20,
    "very_uncomfortable": 0.20,
    "very_windy": 0.15,
    "very_cold": 0.10,
}

#: Fixed rainfall tiers, always reported regardless of the wet threshold.
RAIN_TIERS: tuple[tuple[str, float, str], ...] = (
    ("any_rain", 1.0, "Any rain (≥ 1 mm)"),
    ("moderate_rain", 5.0, "Moderate rain (≥ 5 mm)"),
    ("heavy_rain", 10.0, "Heavy rain (≥ 10 mm)"),
)


# --------------------------------------------------------------------------- #
# Day-of-year window sampling
# --------------------------------------------------------------------------- #


def resolve_target_date(year: int, month: int, day: int) -> date | None:
    """Anchor a (month, day) pair inside a specific year.

    Feb 29 in a non-leap year degrades gracefully to Feb 28 rather than being
    dropped, so leap-day parades still get 30 years of context.
    """
    try:
        return date(year, month, day)
    except ValueError:
        if month == 2 and day == 29:
            return date(year, 2, 28)
        last_day = calendar.monthrange(year, month)[1] if 1 <= month <= 12 else 0
        if last_day and day > last_day:
            return None
        return None


@dataclass(slots=True)
class WindowSample:
    """Every historical observation inside the target date's +/- N day window."""

    dates: list[date]
    years: NDArray[np.int_]
    values: dict[str, NDArray[np.float64]]
    expected_days: int
    fill_value_days: dict[str, int]

    @property
    def size(self) -> int:
        return len(self.dates)

    def valid(self, variable: str) -> NDArray[np.float64]:
        column = self.values[variable]
        return column[~np.isnan(column)]


def collect_window(series: PowerSeries, month: int, day: int, window: int) -> WindowSample:
    """Gather the +/- ``window`` day sample around (month, day) for every year.

    The window is built with real date arithmetic per year, so it wraps across
    the year boundary correctly: a Jan 3 target with ``window=7`` reaches back
    into the previous December.
    """
    indices: list[int] = []
    years: list[int] = []
    sample_dates: list[date] = []
    year_count = 0

    for year in range(series.start_year, series.end_year + 1):
        target = resolve_target_date(year, month, day)
        if target is None:
            continue
        year_count += 1
        for offset in range(-window, window + 1):
            current = target + timedelta(days=offset)
            idx = series.index_of(current)
            if idx is not None:
                indices.append(idx)
                years.append(year)
                sample_dates.append(current)

    idx_array = np.array(indices, dtype=np.int_)
    values: dict[str, NDArray[np.float64]] = {}
    fill_value_days: dict[str, int] = {}

    for param, column in series.values.items():
        picked = column[idx_array] if idx_array.size else np.array([], dtype=np.float64)
        values[param] = picked
        fill_value_days[param] = int(np.isnan(picked).sum())

    # Derived variable: NOAA heat index from daily max temperature + humidity.
    if idx_array.size:
        values[HEAT_INDEX] = heat_index_celsius(values["T2M_MAX"], values["RH2M"])
    else:
        values[HEAT_INDEX] = np.array([], dtype=np.float64)
    fill_value_days[HEAT_INDEX] = int(np.isnan(values[HEAT_INDEX]).sum())

    return WindowSample(
        dates=sample_dates,
        years=np.array(years, dtype=np.int_),
        values=values,
        expected_days=year_count * (2 * window + 1),
        fill_value_days=fill_value_days,
    )


# --------------------------------------------------------------------------- #
# Descriptive statistics
# --------------------------------------------------------------------------- #


def _clean(value: float) -> float | None:
    """JSON-safe float (NaN/inf are not valid JSON)."""
    if value is None or not math.isfinite(float(value)):
        return None
    return round(float(value), 4)


def describe(
    values: NDArray[np.float64], years: NDArray[np.int_], unit: str
) -> dict[str, object]:
    """Mean/std/extremes (with the year they occurred) and key percentiles."""
    mask = ~np.isnan(values)
    valid = values[mask]
    valid_years = years[mask] if years.size == values.size else np.array([], dtype=np.int_)

    if valid.size == 0:
        return {
            "unit": unit,
            "valid_count": 0,
            "mean": None,
            "std": None,
            "min": None,
            "min_year": None,
            "max": None,
            "max_year": None,
            "percentiles": {},
        }

    min_pos = int(np.argmin(valid))
    max_pos = int(np.argmax(valid))
    p10, p25, p50, p75, p90 = np.percentile(valid, [10, 25, 50, 75, 90])

    return {
        "unit": unit,
        "valid_count": int(valid.size),
        "mean": _clean(float(np.mean(valid))),
        "std": _clean(float(np.std(valid, ddof=1))) if valid.size > 1 else 0.0,
        "min": _clean(float(valid[min_pos])),
        "min_year": int(valid_years[min_pos]) if valid_years.size else None,
        "max": _clean(float(valid[max_pos])),
        "max_year": int(valid_years[max_pos]) if valid_years.size else None,
        "percentiles": {
            "p10": _clean(float(p10)),
            "p25": _clean(float(p25)),
            "p50": _clean(float(p50)),
            "p75": _clean(float(p75)),
            "p90": _clean(float(p90)),
        },
    }


def build_histogram(
    values: NDArray[np.float64], bins: int = HISTOGRAM_BINS
) -> dict[str, list[float] | list[int]]:
    """Histogram the frontend can render directly (edges + counts)."""
    valid = values[~np.isnan(values)]
    if valid.size == 0:
        return {"bin_edges": [], "counts": []}

    low = float(np.min(valid))
    high = float(np.max(valid))
    if math.isclose(low, high):
        # A degenerate distribution (e.g. always-zero rainfall) still needs a
        # renderable bin so charts do not blow up.
        half = max(abs(low) * 0.05, 0.5)
        low, high = low - half, high + half

    counts, edges = np.histogram(valid, bins=bins, range=(low, high))
    return {
        "bin_edges": [round(float(e), 4) for e in edges],
        "counts": [int(c) for c in counts],
    }


def exceedance_probability(
    values: NDArray[np.float64], threshold: float, direction: Direction
) -> tuple[float, int, int]:
    """Empirical P(exceed) plus the exceeding and valid sample counts."""
    valid = values[~np.isnan(values)]
    if valid.size == 0:
        return 0.0, 0, 0
    hits = valid > threshold if direction == "above" else valid < threshold
    exceed = int(np.count_nonzero(hits))
    return exceed / valid.size, exceed, int(valid.size)


def at_least_probability(values: NDArray[np.float64], threshold: float) -> float:
    """P(value >= threshold) — used for the inclusive rainfall tiers."""
    valid = values[~np.isnan(values)]
    if valid.size == 0:
        return 0.0
    return float(np.count_nonzero(valid >= threshold) / valid.size)


def percentile_of_threshold(values: NDArray[np.float64], threshold: float) -> float | None:
    """Where the user's threshold sits within this location's distribution."""
    valid = values[~np.isnan(values)]
    if valid.size == 0:
        return None
    below = float(np.count_nonzero(valid < threshold))
    equal = float(np.count_nonzero(valid == threshold))
    return round(100.0 * (below + 0.5 * equal) / valid.size, 1)


def _ordinal(value: float) -> str:
    n = int(round(value))
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


# --------------------------------------------------------------------------- #
# Climate trend
# --------------------------------------------------------------------------- #


def yearly_exceedance(
    values: NDArray[np.float64],
    years: NDArray[np.int_],
    threshold: float,
    direction: Direction,
) -> list[dict[str, float | int]]:
    """Per-year exceedance fraction inside the window."""
    points: list[dict[str, float | int]] = []
    if values.size == 0:
        return points

    mask = ~np.isnan(values)
    valid_values = values[mask]
    valid_years = years[mask]

    for year in np.unique(valid_years):
        subset = valid_values[valid_years == year]
        if subset.size == 0:
            continue
        hits = subset > threshold if direction == "above" else subset < threshold
        points.append(
            {
                "year": int(year),
                "value": round(float(np.count_nonzero(hits) / subset.size), 4),
                "samples": int(subset.size),
            }
        )
    return points


def compute_trend(
    points: Sequence[dict[str, float | int]], label: str
) -> dict[str, object]:
    """Linear regression of yearly exceedance fraction against year.

    The challenge brief specifically flags that extreme-weather probabilities
    are shifting, so orbitWx reports the slope per decade *and* an explicit
    first-decade vs last-decade comparison in plain language.
    """
    empty = {
        "slope_per_decade": None,
        "direction": "insufficient_data",
        "first_decade": None,
        "last_decade": None,
        "first_decade_label": None,
        "last_decade_label": None,
        "delta": None,
        "summary": f"Not enough valid samples to assess a trend in {label.lower()} odds.",
        "yearly": list(points),
    }
    if len(points) < 5:
        return empty

    years = np.array([p["year"] for p in points], dtype=np.float64)
    fractions = np.array([p["value"] for p in points], dtype=np.float64)

    slope, _intercept = np.polyfit(years, fractions, 1)
    slope_per_decade = float(slope) * 10.0

    # First vs last decade of the covered span.
    first_year, last_year = int(years[0]), int(years[-1])
    first_cut = first_year + 9
    last_cut = last_year - 9
    first_mask = years <= first_cut
    last_mask = years >= last_cut
    first_mean = float(np.mean(fractions[first_mask])) if first_mask.any() else None
    last_mean = float(np.mean(fractions[last_mask])) if last_mask.any() else None

    if first_mean is None or last_mean is None:
        return {**empty, "slope_per_decade": round(slope_per_decade, 5), "yearly": list(points)}

    delta = last_mean - first_mean
    if abs(delta) < 0.02:
        direction = "stable"
        summary = (
            f"{label} odds on this date have held roughly steady near "
            f"{round(last_mean * 100)}% across {first_year}–{last_year}."
        )
    else:
        direction = "increasing" if delta > 0 else "decreasing"
        verb = "rose" if delta > 0 else "fell"
        summary = (
            f"{label} odds on this date {verb} from {round(first_mean * 100)}% "
            f"({first_year}–{first_cut}) to {round(last_mean * 100)}% "
            f"({last_cut}–{last_year})."
        )

    return {
        "slope_per_decade": round(slope_per_decade, 5),
        "direction": direction,
        "first_decade": round(first_mean, 4),
        "last_decade": round(last_mean, 4),
        "first_decade_label": f"{first_year}–{first_cut}",
        "last_decade_label": f"{last_cut}–{last_year}",
        "delta": round(delta, 4),
        "summary": summary,
        "yearly": list(points),
    }


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def risk_level(probability: float) -> str:
    if probability < 0.15:
        return "low"
    if probability <= 0.40:
        return "moderate"
    return "high"


def analyse_condition(
    spec: ConditionSpec, sample: WindowSample, threshold: float
) -> dict[str, object]:
    values = sample.values[spec.variable]
    probability, exceed, valid_count = exceedance_probability(values, threshold, spec.direction)
    pct = percentile_of_threshold(values, threshold)

    if pct is None:
        context = "No valid observations for this variable at this grid cell."
    else:
        share = round(100 - pct) if spec.direction == "above" else round(pct)
        side = "above" if spec.direction == "above" else "below"
        context = (
            f"{threshold:g} {spec.unit} is the {_ordinal(pct)} percentile of "
            f"{spec.metric_label} for this date here — {share}% of the historical "
            f"sample sat {side} it."
        )

    trend_points = yearly_exceedance(values, sample.years, threshold, spec.direction)

    return {
        "key": spec.key,
        "label": spec.label,
        "variable": spec.variable,
        "description": spec.description,
        "direction": spec.direction,
        "threshold": threshold,
        "unit": spec.unit,
        "probability": round(probability, 4),
        "percent": round(probability * 100, 1),
        "risk_level": risk_level(probability),
        "exceeding_samples": exceed,
        "valid_samples": valid_count,
        "threshold_percentile": pct,
        "threshold_context": context,
        "stats": describe(values, sample.years, spec.unit),
        "histogram": build_histogram(values),
        "trend": compute_trend(trend_points, spec.label),
    }


def rain_tier_probabilities(sample: WindowSample) -> list[dict[str, object]]:
    """The headline "will my parade get rained on" tiers."""
    values = sample.values["PRECTOTCORR"]
    tiers: list[dict[str, object]] = []
    valid = values[~np.isnan(values)]
    for key, threshold, label in RAIN_TIERS:
        if valid.size == 0:
            probability = 0.0
            exceed = 0
        else:
            exceed = int(np.count_nonzero(valid >= threshold))
            probability = exceed / valid.size
        tiers.append(
            {
                "key": key,
                "label": label,
                "threshold_mm": threshold,
                "probability": round(probability, 4),
                "percent": round(probability * 100, 1),
                "exceeding_samples": exceed,
                "valid_samples": int(valid.size),
                "risk_level": risk_level(probability),
            }
        )
    return tiers


def combined_risk_score(conditions: dict[str, dict[str, object]]) -> float:
    """Weighted mean of the five condition probabilities."""
    total = 0.0
    for key, weight in RISK_WEIGHTS.items():
        block = conditions.get(key)
        if block is not None:
            total += weight * float(block["probability"])  # type: ignore[arg-type]
    return round(total, 4)


MONTH_NAMES = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


def build_summary(
    conditions: dict[str, dict[str, object]],
    tiers: list[dict[str, object]],
    month: int,
    day: int,
    window: int,
    year_span: int,
) -> dict[str, object]:
    any_rain = next(t for t in tiers if t["key"] == "any_rain")
    heavy_rain = next(t for t in tiers if t["key"] == "heavy_rain")
    score = combined_risk_score(conditions)

    driver = max(conditions.values(), key=lambda c: float(c["probability"]))  # type: ignore[arg-type]

    return {
        "headline": f"{any_rain['percent']}% chance of rain on your parade",
        "detail": (
            f"Based on {year_span} years of NASA satellite-derived observations for "
            f"{MONTH_NAMES[month - 1]} {day} (±{window} days) at this location."
        ),
        "any_rain_percent": any_rain["percent"],
        "heavy_rain_percent": heavy_rain["percent"],
        "overall_risk_score": score,
        "overall_risk_level": risk_level(score),
        "dominant_risk": driver["key"],
        "dominant_risk_label": driver["label"],
        "dominant_risk_percent": driver["percent"],
    }


def resolve_thresholds(overrides: dict[str, float | None]) -> dict[str, float]:
    """Merge user threshold overrides onto the documented defaults."""
    return {
        spec.key: (
            overrides.get(spec.key)
            if overrides.get(spec.key) is not None
            else spec.default_threshold
        )
        for spec in CONDITIONS
    }  # type: ignore[return-value]


def analyse(
    series: PowerSeries,
    month: int,
    day: int,
    window: int,
    thresholds: dict[str, float],
) -> dict[str, object]:
    """Full probability analysis for one location + calendar date."""
    sample = collect_window(series, month, day, window)

    conditions = {
        spec.key: analyse_condition(spec, sample, thresholds[spec.key]) for spec in CONDITIONS
    }
    tiers = rain_tier_probabilities(sample)
    year_span = series.end_year - series.start_year + 1

    return {
        "conditions": conditions,
        "rain_tiers": tiers,
        "summary": build_summary(conditions, tiers, month, day, window, year_span),
        "sample": sample,
    }


def score_day(sample: WindowSample, thresholds: dict[str, float]) -> tuple[float, dict[str, float]]:
    """Combined risk score for a single day (used by the Smart Date Finder)."""
    probabilities: dict[str, float] = {}
    score = 0.0
    for spec in CONDITIONS:
        probability, _, _ = exceedance_probability(
            sample.values[spec.variable], thresholds[spec.key], spec.direction
        )
        probabilities[spec.key] = round(probability, 4)
        score += RISK_WEIGHTS[spec.key] * probability
    return round(score, 4), probabilities


def units_map() -> dict[str, str]:
    return dict(PARAMETER_UNITS)


def build_metadata(
    series: PowerSeries,
    sample: WindowSample,
    requested_lat: float,
    requested_lon: float,
    month: int,
    day: int,
    window: int,
    cache_hit: bool,
) -> dict[str, object]:
    """Provenance block attached to every response.

    The challenge brief requires that data source, resolution and coverage
    travel with the output — not just live in the docs.
    """
    return {
        "source": "NASA POWER / MERRA-2",
        "source_project": (
            "Data obtained from the NASA Langley Research Center (LaRC) POWER Project"
        ),
        "grid_cell": {
            "lat": series.grid_lat,
            "lon": series.grid_lon,
            "requested_lat": round(requested_lat, 4),
            "requested_lon": round(requested_lon, 4),
            "resolution": "0.5° latitude × 0.625° longitude",
        },
        "start_year": series.start_year,
        "end_year": series.end_year,
        "years_covered": series.end_year - series.start_year + 1,
        "target_month": month,
        "target_day": day,
        "window_days": window,
        "sample_size": sample.size,
        "expected_sample_size": sample.expected_days,
        "missing_days": max(sample.expected_days - sample.size, 0),
        "fill_value_days": {
            param: sample.fill_value_days.get(param, 0)
            for param in (*POWER_PARAMETERS, HEAT_INDEX)
        },
        "units": units_map(),
        "cache_hit": cache_hit,
        "power_url_pattern": POWER_URL_PATTERN.format(
            parameters=",".join(POWER_PARAMETERS),
            lat=series.grid_lat,
            lon=series.grid_lon,
            start=f"{series.start_year}0101",
            end=f"{series.end_year}1231",
        ),
        "generated_note": (
            "Climatology, not a forecast: these are historical likelihoods derived from "
            "NASA Earth observation data, not a prediction for a specific upcoming day."
        ),
    }
