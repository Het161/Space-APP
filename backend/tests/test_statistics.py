"""Probability engine — verified against a hand-computable fixture."""

from __future__ import annotations

from datetime import date

import numpy as np
import pytest

from app.services import statistics as stats
from app.services.nasa_power import PowerSeries
from tests.conftest import build_series

# --------------------------------------------------------------------------- #
# Day-of-year window sampling
# --------------------------------------------------------------------------- #


def test_window_size_mid_year(three_year_series: PowerSeries) -> None:
    """June 15 ±7 days = 15 days/year x 3 years, none missing."""
    sample = stats.collect_window(three_year_series, month=6, day=15, window=7)
    assert sample.size == 45
    assert sample.expected_days == 45


def test_window_wraps_across_the_year_boundary(three_year_series: PowerSeries) -> None:
    """Jan 3 ±7 must reach back into the previous December."""
    sample = stats.collect_window(three_year_series, month=1, day=3, window=7)

    # 2001 loses the Dec-2000 half (outside the record); 2002 and 2003 are full.
    assert sample.size == 10 + 15 + 15
    assert sample.expected_days == 45

    assert date(2001, 12, 27) in sample.dates
    assert date(2002, 12, 27) in sample.dates
    # December days belong to the *following* year's window.
    dec_index = sample.dates.index(date(2001, 12, 27))
    assert sample.years[dec_index] == 2002


def test_leap_day_target_degrades_to_feb_28() -> None:
    assert stats.resolve_target_date(2024, 2, 29) == date(2024, 2, 29)
    assert stats.resolve_target_date(2023, 2, 29) == date(2023, 2, 28)
    assert stats.resolve_target_date(2023, 4, 31) is None


def test_leap_day_target_samples_every_year(three_year_series: PowerSeries) -> None:
    """2001–2003 contains no Feb 29, yet a leap-day target still gets 3 years."""
    sample = stats.collect_window(three_year_series, month=2, day=29, window=3)
    assert sample.size == 21
    assert set(np.unique(sample.years)) == {2001, 2002, 2003}


# --------------------------------------------------------------------------- #
# Fill-value handling
# --------------------------------------------------------------------------- #


def test_fill_values_are_excluded_from_statistics() -> None:
    """POWER's -999 must never reach a mean, a probability or a percentile."""

    def generator(d: date) -> dict[str, float | None]:
        # Every third day of June is a fill value.
        wet = None if (d.month == 6 and d.day % 3 == 0) else 20.0
        return {
            "T2M": 25.0,
            "T2M_MAX": 30.0,
            "T2M_MIN": 20.0,
            "PRECTOTCORR": wet,
            "WS10M": 3.0,
            "WS2M": 2.0,
            "RH2M": 50.0,
            "T2MDEW": 12.0,
        }

    series = build_series(2001, 2003, generator)
    sample = stats.collect_window(series, month=6, day=15, window=7)

    # June 9, 12, 15, 18, 21 are fill values -> 5 per year, 15 overall.
    assert sample.fill_value_days["PRECTOTCORR"] == 15
    assert sample.size == 45

    probability, exceed, valid = stats.exceedance_probability(
        sample.values["PRECTOTCORR"], 10.0, "above"
    )
    assert valid == 30
    assert exceed == 30
    assert probability == 1.0

    described = stats.describe(sample.values["PRECTOTCORR"], sample.years, "mm/day")
    assert described["valid_count"] == 30
    assert described["mean"] == pytest.approx(20.0)
    assert described["min"] == pytest.approx(20.0)  # never -999


def test_series_parsing_converts_minus_999_to_nan() -> None:
    from app.services.nasa_power import NasaPowerClient

    chunk = {
        "T2M": {"20010101": 25.0, "20010102": -999.0},
        "T2M_MAX": {"20010101": 30.0, "20010102": 31.0},
        "T2M_MIN": {"20010101": 20.0, "20010102": 21.0},
        "PRECTOTCORR": {"20010101": 0.0, "20010102": 5.0},
        "WS10M": {"20010101": 3.0, "20010102": -999.0},
        "WS2M": {"20010101": 2.0, "20010102": 2.5},
        "RH2M": {"20010101": 50.0, "20010102": 55.0},
        "T2MDEW": {"20010101": 12.0, "20010102": 13.0},
    }
    series = NasaPowerClient._parse([chunk], 23.0, 72.5, 2001, 2001)

    assert np.isnan(series.values["T2M"][1])
    assert np.isnan(series.values["WS10M"][1])
    assert series.missing_counts["T2M"] == 1
    assert series.values["T2M"][0] == pytest.approx(25.0)


# --------------------------------------------------------------------------- #
# Exceedance probabilities
# --------------------------------------------------------------------------- #


def test_hand_computed_probabilities(three_year_series: PowerSeries) -> None:
    """June 8–22 has 8 even days (wet/hot) and 3 multiples of five (windy)."""
    sample = stats.collect_window(three_year_series, month=6, day=15, window=7)
    thresholds = stats.resolve_thresholds({})

    wet, _, _ = stats.exceedance_probability(sample.values["PRECTOTCORR"], 10.0, "above")
    hot, _, _ = stats.exceedance_probability(sample.values["T2M_MAX"], 35.0, "above")
    cold, _, _ = stats.exceedance_probability(sample.values["T2M_MIN"], 5.0, "below")
    windy, _, _ = stats.exceedance_probability(sample.values["WS10M"], 10.0, "above")

    assert wet == pytest.approx(24 / 45)
    assert hot == pytest.approx(24 / 45)
    assert cold == 0.0
    assert windy == pytest.approx(9 / 45)

    score, probabilities = stats.score_day(sample, thresholds)
    assert probabilities["very_cold"] == 0.0
    assert score == pytest.approx(
        0.35 * (24 / 45) + 0.20 * (24 / 45) + 0.20 * (24 / 45) + 0.15 * (9 / 45),
        abs=1e-3,
    )


def test_cold_condition_uses_below_direction(three_year_series: PowerSeries) -> None:
    """January minima of 2 °C must register as very cold."""
    sample = stats.collect_window(three_year_series, month=1, day=15, window=7)
    cold, _, valid = stats.exceedance_probability(sample.values["T2M_MIN"], 5.0, "below")
    assert cold == 1.0
    assert valid == 45


def test_rain_tiers_are_inclusive(three_year_series: PowerSeries) -> None:
    sample = stats.collect_window(three_year_series, month=6, day=15, window=7)
    tiers = {t["key"]: t for t in stats.rain_tier_probabilities(sample)}

    assert tiers["any_rain"]["probability"] == pytest.approx(round(24 / 45, 4))
    assert tiers["heavy_rain"]["threshold_mm"] == 10.0
    # 20 mm clears every tier, so all three agree on this fixture.
    assert tiers["moderate_rain"]["probability"] == tiers["heavy_rain"]["probability"]


def test_at_least_probability_is_inclusive() -> None:
    values = np.array([0.0, 1.0, 5.0, 10.0, np.nan])
    assert stats.at_least_probability(values, 1.0) == pytest.approx(3 / 4)
    assert stats.at_least_probability(values, 10.0) == pytest.approx(1 / 4)


def test_empty_sample_is_safe() -> None:
    empty = np.array([], dtype=np.float64)
    assert stats.exceedance_probability(empty, 10.0, "above") == (0.0, 0, 0)
    assert stats.percentile_of_threshold(empty, 10.0) is None
    assert stats.build_histogram(empty) == {"bin_edges": [], "counts": []}


# --------------------------------------------------------------------------- #
# Percentiles, histograms
# --------------------------------------------------------------------------- #


def test_threshold_percentile() -> None:
    values = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0])
    assert stats.percentile_of_threshold(values, 5.5) == pytest.approx(50.0)
    assert stats.percentile_of_threshold(values, 11.0) == pytest.approx(100.0)
    assert stats.percentile_of_threshold(values, 0.0) == pytest.approx(0.0)


def test_histogram_shape_and_totals() -> None:
    values = np.concatenate([np.linspace(0.0, 10.0, 100), np.array([np.nan] * 5)])
    histogram = stats.build_histogram(values, bins=10)
    assert len(histogram["bin_edges"]) == 11
    assert len(histogram["counts"]) == 10
    assert sum(histogram["counts"]) == 100  # NaNs excluded


def test_histogram_handles_constant_series() -> None:
    """An always-dry desert would otherwise produce a zero-width range."""
    histogram = stats.build_histogram(np.zeros(50), bins=5)
    assert sum(histogram["counts"]) == 50
    assert histogram["bin_edges"][0] < histogram["bin_edges"][-1]


def test_describe_reports_extreme_years() -> None:
    def generator(d: date) -> dict[str, float | None]:
        spike = 60.0 if (d.year == 2002 and d.month == 6 and d.day == 15) else 10.0
        return {
            "T2M": 25.0,
            "T2M_MAX": 30.0,
            "T2M_MIN": 20.0,
            "PRECTOTCORR": spike,
            "WS10M": 3.0,
            "WS2M": 2.0,
            "RH2M": 50.0,
            "T2MDEW": 12.0,
        }

    series = build_series(2001, 2003, generator)
    sample = stats.collect_window(series, month=6, day=15, window=7)
    described = stats.describe(sample.values["PRECTOTCORR"], sample.years, "mm/day")

    assert described["max"] == pytest.approx(60.0)
    assert described["max_year"] == 2002
    assert described["percentiles"]["p50"] == pytest.approx(10.0)


# --------------------------------------------------------------------------- #
# Climate trend
# --------------------------------------------------------------------------- #


def _trending_series(start: int = 1996, end: int = 2025) -> PowerSeries:
    """Rain frequency in the June window climbs steadily with the year."""

    def generator(d: date) -> dict[str, float | None]:
        # 0 wet days in the first year, rising to ~14 by the last.
        wet_days = int(round((d.year - start) / (end - start) * 14))
        is_wet = d.month == 6 and 8 <= d.day <= 8 + wet_days - 1
        return {
            "T2M": 25.0,
            "T2M_MAX": 30.0,
            "T2M_MIN": 20.0,
            "PRECTOTCORR": 25.0 if is_wet else 0.0,
            "WS10M": 3.0,
            "WS2M": 2.0,
            "RH2M": 50.0,
            "T2MDEW": 12.0,
        }

    return build_series(start, end, generator)


def test_trend_detects_a_rising_signal() -> None:
    series = _trending_series()
    sample = stats.collect_window(series, month=6, day=15, window=7)
    points = stats.yearly_exceedance(sample.values["PRECTOTCORR"], sample.years, 10.0, "above")
    trend = stats.compute_trend(points, "Heavy rain")

    assert len(points) == 30
    assert trend["direction"] == "increasing"
    assert trend["slope_per_decade"] > 0
    assert trend["first_decade"] < trend["last_decade"]
    assert trend["first_decade_label"] == "1996–2005"
    assert trend["last_decade_label"] == "2016–2025"
    assert "rose from" in trend["summary"]


def test_trend_reports_stability_when_flat(three_year_series: PowerSeries) -> None:
    series = build_series(
        1996,
        2025,
        lambda d: {
            "T2M": 25.0,
            "T2M_MAX": 30.0,
            "T2M_MIN": 20.0,
            "PRECTOTCORR": 20.0 if d.day % 2 == 0 else 0.0,
            "WS10M": 3.0,
            "WS2M": 2.0,
            "RH2M": 50.0,
            "T2MDEW": 12.0,
        },
    )
    sample = stats.collect_window(series, month=6, day=15, window=7)
    points = stats.yearly_exceedance(sample.values["PRECTOTCORR"], sample.years, 10.0, "above")
    trend = stats.compute_trend(points, "Heavy rain")

    assert trend["direction"] == "stable"
    assert trend["slope_per_decade"] == pytest.approx(0.0, abs=1e-6)
    assert "held roughly steady" in trend["summary"]


def test_trend_needs_enough_years(three_year_series: PowerSeries) -> None:
    sample = stats.collect_window(three_year_series, month=6, day=15, window=7)
    points = stats.yearly_exceedance(sample.values["PRECTOTCORR"], sample.years, 10.0, "above")
    trend = stats.compute_trend(points, "Heavy rain")
    assert trend["direction"] == "insufficient_data"
    assert trend["slope_per_decade"] is None


# --------------------------------------------------------------------------- #
# Full analysis
# --------------------------------------------------------------------------- #


def test_analyse_returns_every_condition(three_year_series: PowerSeries) -> None:
    result = stats.analyse(
        three_year_series, month=6, day=15, window=7, thresholds=stats.resolve_thresholds({})
    )
    conditions = result["conditions"]

    assert set(conditions) == {
        "very_hot",
        "very_cold",
        "very_windy",
        "very_wet",
        "very_uncomfortable",
    }
    assert conditions["very_wet"]["percent"] == pytest.approx(53.3, abs=0.1)
    assert conditions["very_cold"]["risk_level"] == "low"
    assert conditions["very_wet"]["risk_level"] == "high"
    # 40 °C max + 60 % RH is a heat index well past 40 °C.
    assert conditions["very_uncomfortable"]["probability"] == pytest.approx(24 / 45, abs=1e-3)

    summary = result["summary"]
    assert "chance of rain on your parade" in summary["headline"]
    assert "June 15" in summary["detail"]


def test_worst_risk_picks_the_most_severe_level() -> None:
    assert stats._worst_risk("low", "low") == "low"
    assert stats._worst_risk("low", "moderate") == "moderate"
    assert stats._worst_risk("moderate", "high", "low") == "high"


def test_verdict_is_not_low_when_one_dimension_dominates() -> None:
    """Regression: a near-certain-rain tropical day must not read "low risk".

    The weighted blend alone scored a 94%-chance-of-rain Singapore day as low,
    because only 36% of days cleared the 10 mm "very wet" bar.
    """

    def generator(d: date) -> dict[str, float | None]:
        # Rain almost every day, but mostly light: clears 1 mm, rarely 10 mm.
        wet = 12.0 if d.day % 3 == 0 else 2.5
        return {
            "T2M": 27.0,
            "T2M_MAX": 30.0,
            "T2M_MIN": 25.0,
            "PRECTOTCORR": wet,
            "WS10M": 2.0,
            "WS2M": 1.5,
            "RH2M": 60.0,
            "T2MDEW": 24.0,
        }

    series = build_series(1996, 2025, generator)
    result = stats.analyse(series, 11, 20, 7, stats.resolve_thresholds({}))
    summary = result["summary"]

    assert summary["any_rain_percent"] == 100.0
    assert summary["overall_risk_score"] < 0.15  # the blend alone says "low"
    assert summary["overall_risk_level"] == "high"


def test_threshold_overrides_are_applied(three_year_series: PowerSeries) -> None:
    thresholds = stats.resolve_thresholds({"very_hot": 45.0})
    result = stats.analyse(three_year_series, 6, 15, 7, thresholds)
    assert result["conditions"]["very_hot"]["threshold"] == 45.0
    assert result["conditions"]["very_hot"]["probability"] == 0.0
    # Untouched conditions keep their documented defaults.
    assert result["conditions"]["very_wet"]["threshold"] == 10.0


def test_metadata_carries_provenance(three_year_series: PowerSeries) -> None:
    sample = stats.collect_window(three_year_series, 1, 3, 7)
    metadata = stats.build_metadata(
        series=three_year_series,
        sample=sample,
        requested_lat=23.0331,
        requested_lon=72.5850,
        month=1,
        day=3,
        window=7,
        cache_hit=False,
    )

    assert metadata["source"] == "NASA POWER / MERRA-2"
    assert "LaRC" in metadata["source_project"]
    assert metadata["grid_cell"]["lat"] == 23.0
    assert metadata["grid_cell"]["requested_lat"] == 23.0331
    assert metadata["missing_days"] == 5  # the Dec-2000 half of the 2001 window
    assert metadata["years_covered"] == 3
    assert "power.larc.nasa.gov" in metadata["power_url_pattern"]
    assert "not a forecast" in metadata["generated_note"]
