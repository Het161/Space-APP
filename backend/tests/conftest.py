"""Shared fixtures. No test in this suite touches the real NASA POWER API."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pytest

from app.services.nasa_power import POWER_PARAMETERS, PowerSeries


def build_series(
    start_year: int,
    end_year: int,
    generator,
    grid_lat: float = 23.0,
    grid_lon: float = 72.5,
) -> PowerSeries:
    """Build a synthetic :class:`PowerSeries` from a ``(date) -> dict`` callable.

    Returning ``None`` for a parameter marks it as a POWER -999 fill value.
    """
    dates: list[date] = []
    day = date(start_year, 1, 1)
    last = date(end_year, 12, 31)
    while day <= last:
        dates.append(day)
        day += timedelta(days=1)

    rows = [generator(d) for d in dates]
    values: dict[str, np.ndarray] = {}
    missing: dict[str, int] = {}
    for param in POWER_PARAMETERS:
        column = np.array(
            [np.nan if row.get(param) is None else float(row[param]) for row in rows],
            dtype=np.float64,
        )
        values[param] = column
        missing[param] = int(np.isnan(column).sum())

    return PowerSeries(
        grid_lat=grid_lat,
        grid_lon=grid_lon,
        start_year=start_year,
        end_year=end_year,
        dates=dates,
        values=values,
        missing_counts=missing,
    )


@pytest.fixture
def three_year_series() -> PowerSeries:
    """Three hand-computable years.

    Rainfall is 20 mm on every day whose day-of-month is even and 0 otherwise,
    so exceedance counts can be checked by hand. Temperatures are constant.
    """

    def generator(d: date) -> dict[str, float | None]:
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

    return build_series(2001, 2003, generator)
