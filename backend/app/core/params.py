"""Shared query-parameter parsing and validation for the /api/v1 endpoints."""

import calendar
from dataclasses import dataclass
from typing import Annotated

from fastapi import HTTPException, Query, status

from app.services.statistics import MONTH_NAMES, resolve_thresholds

#: 2024 is a leap year, so this table accepts Feb 29 while rejecting Feb 30.
_MAX_DAY_PER_MONTH = {m: calendar.monthrange(2024, m)[1] for m in range(1, 13)}

LatQuery = Annotated[float, Query(ge=-90, le=90, description="Latitude in degrees (WGS84).")]
LonQuery = Annotated[float, Query(ge=-180, le=180, description="Longitude in degrees (WGS84).")]
MonthQuery = Annotated[int, Query(ge=1, le=12, description="Target month, 1–12.")]
DayQuery = Annotated[int, Query(ge=1, le=31, description="Target day of month, 1–31.")]
WindowQuery = Annotated[
    int,
    Query(ge=1, le=15, description="Day-of-year half-window; ±N days around the target date."),
]

HotThreshold = Annotated[
    float | None, Query(description="Very Hot: T2M_MAX above this many °C. Default 35.")
]
ColdThreshold = Annotated[
    float | None, Query(description="Very Cold: T2M_MIN below this many °C. Default 5.")
]
WindThreshold = Annotated[
    float | None, Query(description="Very Windy: WS10M above this many m/s. Default 10.")
]
WetThreshold = Annotated[
    float | None, Query(description="Very Wet: precipitation above this many mm/day. Default 10.")
]
ComfortThreshold = Annotated[
    float | None, Query(description="Very Uncomfortable: heat index above this many °C. Default 40.")
]


def validate_calendar_date(month: int, day: int) -> None:
    """Reject impossible calendar dates such as Feb 31 or Apr 31."""
    max_day = _MAX_DAY_PER_MONTH[month]
    if day > max_day:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"{MONTH_NAMES[month - 1]} has at most {max_day} days — "
                f"'{MONTH_NAMES[month - 1]} {day}' is not a valid calendar date."
            ),
        )


@dataclass(slots=True)
class AnalysisQuery:
    """Validated inputs shared by /probability and /export."""

    lat: float
    lon: float
    month: int
    day: int
    window: int
    thresholds: dict[str, float]


def analysis_query(
    lat: LatQuery,
    lon: LonQuery,
    month: MonthQuery,
    day: DayQuery,
    window: WindowQuery = 7,
    hot_threshold: HotThreshold = None,
    cold_threshold: ColdThreshold = None,
    wind_threshold: WindThreshold = None,
    wet_threshold: WetThreshold = None,
    comfort_threshold: ComfortThreshold = None,
) -> AnalysisQuery:
    validate_calendar_date(month, day)
    thresholds = resolve_thresholds(
        {
            "very_hot": hot_threshold,
            "very_cold": cold_threshold,
            "very_windy": wind_threshold,
            "very_wet": wet_threshold,
            "very_uncomfortable": comfort_threshold,
        }
    )
    return AnalysisQuery(
        lat=lat, lon=lon, month=month, day=day, window=window, thresholds=thresholds
    )


@dataclass(slots=True)
class MonthQueryParams:
    """Validated inputs for the Smart Date Finder."""

    lat: float
    lon: float
    month: int
    window: int
    thresholds: dict[str, float]


def month_query(
    lat: LatQuery,
    lon: LonQuery,
    month: MonthQuery,
    window: WindowQuery = 7,
    hot_threshold: HotThreshold = None,
    cold_threshold: ColdThreshold = None,
    wind_threshold: WindThreshold = None,
    wet_threshold: WetThreshold = None,
    comfort_threshold: ComfortThreshold = None,
) -> MonthQueryParams:
    thresholds = resolve_thresholds(
        {
            "very_hot": hot_threshold,
            "very_cold": cold_threshold,
            "very_windy": wind_threshold,
            "very_wet": wet_threshold,
            "very_uncomfortable": comfort_threshold,
        }
    )
    return MonthQueryParams(
        lat=lat, lon=lon, month=month, window=window, thresholds=thresholds
    )
