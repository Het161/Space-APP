"""Apparent-temperature ("feels like") maths.

orbitWx uses the NOAA/Rothfusz heat-index regression, the same polynomial the
US National Weather Service publishes, so the "very uncomfortable" condition is
traceable to a documented standard rather than a bespoke formula.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

# The Rothfusz regression is only meaningful in warm air. Below 80 °F the NWS
# reports the dry-bulb temperature unchanged.
HEAT_INDEX_MIN_F = 80.0
HEAT_INDEX_MIN_C = 26.666666666666668  # 80 °F


def celsius_to_fahrenheit(celsius: NDArray[np.float64]) -> NDArray[np.float64]:
    return celsius * 9.0 / 5.0 + 32.0


def fahrenheit_to_celsius(fahrenheit: NDArray[np.float64]) -> NDArray[np.float64]:
    return (fahrenheit - 32.0) * 5.0 / 9.0


def heat_index_fahrenheit(
    temp_f: NDArray[np.float64], humidity: NDArray[np.float64]
) -> NDArray[np.float64]:
    """Rothfusz regression, evaluated element-wise.

    ``temp_f`` is dry-bulb temperature in °F, ``humidity`` is relative humidity
    in percent. Below 80 °F the heat index is defined as the temperature
    itself. NaNs propagate so that missing NASA POWER values stay missing.
    """
    t = np.asarray(temp_f, dtype=np.float64)
    rh = np.asarray(humidity, dtype=np.float64)

    t2 = t * t
    rh2 = rh * rh

    hi = (
        -42.379
        + 2.04901523 * t
        + 10.14333127 * rh
        - 0.22475541 * t * rh
        - 0.00683783 * t2
        - 0.05481717 * rh2
        + 0.00122874 * t2 * rh
        + 0.00085282 * t * rh2
        - 0.00000199 * t2 * rh2
    )

    # Outside the regression's validity range, fall back to the dry-bulb value.
    warm = t >= HEAT_INDEX_MIN_F
    return np.where(warm, hi, t)


def heat_index_celsius(
    temp_c: NDArray[np.float64], humidity: NDArray[np.float64]
) -> NDArray[np.float64]:
    """Heat index in °C from temperature in °C and relative humidity in %."""
    temp_c = np.asarray(temp_c, dtype=np.float64)
    humidity = np.asarray(humidity, dtype=np.float64)
    hi_f = heat_index_fahrenheit(celsius_to_fahrenheit(temp_c), humidity)
    return fahrenheit_to_celsius(hi_f)
