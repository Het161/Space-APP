"""Climatological probability endpoints."""

import calendar
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.limiter import API_RATE_LIMIT, limiter
from app.core.params import AnalysisQuery, MonthQueryParams, analysis_query, month_query
from app.models.schemas import BestDaysResponse, ProbabilityResponse
from app.services import statistics as stats
from app.services.nasa_power import power_client

router = APIRouter(prefix="/api/v1", tags=["probability"])


@router.get(
    "/probability",
    response_model=ProbabilityResponse,
    summary="Historical probability of adverse conditions on a calendar date",
    response_description=(
        "Exceedance probabilities, distributions and climate trends for the five "
        "adverse-condition questions, plus fixed rainfall tiers and full provenance."
    ),
)
@limiter.limit(API_RATE_LIMIT)
async def probability(
    request: Request,
    query: Annotated[AnalysisQuery, Depends(analysis_query)],
) -> ProbabilityResponse:
    """Answer *"what are the odds of bad weather here, on this date?"*

    This is **climatology, not a forecast**: every number is the empirical
    frequency across ~30 years of NASA POWER daily records inside a ±`window`
    day-of-year sample around the target date.
    """
    series, cache_hit = await power_client.get_series(query.lat, query.lon)
    result = stats.analyse(series, query.month, query.day, query.window, query.thresholds)
    sample = result["sample"]

    return ProbabilityResponse.model_validate(
        {
            "summary": result["summary"],
            "conditions": result["conditions"],
            "rain_tiers": result["rain_tiers"],
            "thresholds": query.thresholds,
            "metadata": stats.build_metadata(
                series=series,
                sample=sample,
                requested_lat=query.lat,
                requested_lon=query.lon,
                month=query.month,
                day=query.day,
                window=query.window,
                cache_hit=cache_hit,
            ),
        }
    )


@router.get(
    "/best-days",
    response_model=BestDaysResponse,
    summary="Smart Date Finder — rank every day of a month by combined risk",
    response_description="Every day of the requested month, ranked from safest to riskiest.",
)
@limiter.limit(API_RATE_LIMIT)
async def best_days(
    request: Request,
    query: Annotated[MonthQueryParams, Depends(month_query)],
) -> BestDaysResponse:
    """Score all days in a month using a single cached POWER fetch.

    The combined risk score is a weighted mean of the five condition
    probabilities (wet 0.35, hot 0.20, uncomfortable 0.20, windy 0.15,
    cold 0.10).
    """
    series, cache_hit = await power_client.get_series(query.lat, query.lon)

    # 2024 is a leap year, so February correctly offers 29 candidate days.
    days_in_month = calendar.monthrange(2024, query.month)[1]
    month_name = stats.MONTH_NAMES[query.month - 1]

    scored: list[dict[str, object]] = []
    reference_sample = None

    for day in range(1, days_in_month + 1):
        sample = stats.collect_window(series, query.month, day, query.window)
        if reference_sample is None:
            reference_sample = sample
        score, probabilities = stats.score_day(sample, query.thresholds)
        any_rain = stats.at_least_probability(sample.values["PRECTOTCORR"], 1.0)
        scored.append(
            {
                "day": day,
                "date_label": f"{month_name} {day}",
                "risk_score": score,
                "risk_level": stats.risk_level(score),
                "rank": 0,
                "probabilities": probabilities,
                "any_rain_probability": round(any_rain, 4),
            }
        )

    ranked = sorted(scored, key=lambda d: float(d["risk_score"]))  # type: ignore[arg-type]
    for position, entry in enumerate(ranked, start=1):
        entry["rank"] = position

    assert reference_sample is not None  # every month has at least one day

    return BestDaysResponse.model_validate(
        {
            "month": query.month,
            "month_name": month_name,
            "days": scored,
            "ranked": ranked,
            "best_three": ranked[:3],
            "thresholds": query.thresholds,
            "metadata": stats.build_metadata(
                series=series,
                sample=reference_sample,
                requested_lat=query.lat,
                requested_lon=query.lon,
                month=query.month,
                day=1,
                window=query.window,
                cache_hit=cache_hit,
            ),
        }
    )
