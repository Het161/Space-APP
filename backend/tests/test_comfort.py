"""Heat index — checked against published NOAA values."""

from __future__ import annotations

import numpy as np
import pytest

from app.services.comfort import (
    celsius_to_fahrenheit,
    heat_index_celsius,
    heat_index_fahrenheit,
)


def test_nws_reference_point_90f_70pct() -> None:
    """The NWS heat index chart reads 106 °F at 90 °F / 70 % RH."""
    result = heat_index_fahrenheit(np.array([90.0]), np.array([70.0]))
    assert result[0] == pytest.approx(105.9, abs=0.5)


def test_32c_at_70pct_is_about_40c() -> None:
    """A muggy 32 °C day feels like roughly 40 °C."""
    result = heat_index_celsius(np.array([32.0]), np.array([70.0]))
    assert result[0] == pytest.approx(40.4, abs=1.0)


def test_below_80f_returns_dry_bulb_unchanged() -> None:
    """Rothfusz is undefined in cool air; the NWS reports the temperature itself."""
    temps_c = np.array([5.0, 15.0, 26.0])
    result = heat_index_celsius(temps_c, np.array([90.0, 20.0, 55.0]))
    np.testing.assert_allclose(result, temps_c, atol=1e-9)


def test_humidity_increases_apparent_temperature() -> None:
    dry = heat_index_celsius(np.array([35.0]), np.array([20.0]))
    humid = heat_index_celsius(np.array([35.0]), np.array([80.0]))
    assert humid[0] > dry[0]


def test_nan_propagates() -> None:
    """Missing POWER observations must stay missing, not become a number."""
    result = heat_index_celsius(np.array([np.nan, 35.0]), np.array([60.0, np.nan]))
    assert np.isnan(result[0])
    assert np.isnan(result[1])


def test_unit_conversion_roundtrip() -> None:
    assert celsius_to_fahrenheit(np.array([0.0]))[0] == pytest.approx(32.0)
    assert celsius_to_fahrenheit(np.array([100.0]))[0] == pytest.approx(212.0)
