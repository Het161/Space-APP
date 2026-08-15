"""Raw-sample export with source attribution (CSV or JSON).

The challenge requires that users can download the data behind the numbers,
with metadata about the source travelling alongside it — so both formats carry
the full provenance block.
"""

import csv
import io
import json
import math
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.limiter import API_RATE_LIMIT, limiter
from app.core.params import AnalysisQuery, analysis_query
from app.services import statistics as stats
from app.services.nasa_power import power_client

router = APIRouter(prefix="/api/v1", tags=["export"])

#: Columns written to the export, in order.
EXPORT_COLUMNS: tuple[str, ...] = (
    "date",
    "year",
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "PRECTOTCORR",
    "WS10M",
    "RH2M",
    "heat_index",
)

_COLUMN_SOURCE: dict[str, str] = {
    "T2M": "T2M",
    "T2M_MAX": "T2M_MAX",
    "T2M_MIN": "T2M_MIN",
    "PRECTOTCORR": "PRECTOTCORR",
    "WS10M": "WS10M",
    "RH2M": "RH2M",
    "heat_index": stats.HEAT_INDEX,
}


def _cell(value: float) -> float | None:
    return None if math.isnan(value) else round(float(value), 3)


def _build_rows(sample: stats.WindowSample) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for i, day in enumerate(sample.dates):
        row: dict[str, object] = {
            "date": day.isoformat(),
            "year": int(sample.years[i]),
        }
        for column, param in _COLUMN_SOURCE.items():
            row[column] = _cell(sample.values[param][i])
        rows.append(row)
    return rows


def _csv_body(rows: list[dict[str, object]], metadata: dict[str, object]) -> str:
    buffer = io.StringIO()
    grid = metadata["grid_cell"]

    comments = [
        "# orbitWx — historical weather probability export",
        f"# source: {metadata['source']}",
        f"# attribution: {metadata['source_project']}",
        f"# api: {metadata['power_url_pattern']}",
        f"# grid_cell: lat={grid['lat']} lon={grid['lon']} ({grid['resolution']})",  # type: ignore[index]
        f"# requested_point: lat={grid['requested_lat']} lon={grid['requested_lon']}",  # type: ignore[index]
        f"# years: {metadata['start_year']}–{metadata['end_year']} "
        f"({metadata['years_covered']} years)",
        f"# target_date: month={metadata['target_month']} day={metadata['target_day']} "
        f"window=±{metadata['window_days']} days",
        f"# samples: {metadata['sample_size']} (missing_days={metadata['missing_days']})",
        "# units: T2M/T2M_MAX/T2M_MIN/heat_index=°C, PRECTOTCORR=mm/day, WS10M=m/s, RH2M=%",
        f"# note: {metadata['generated_note']}",
    ]
    for comment in comments:
        buffer.write(comment + "\n")

    writer = csv.DictWriter(buffer, fieldnames=list(EXPORT_COLUMNS), extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: ("" if row[key] is None else row[key]) for key in EXPORT_COLUMNS})
    return buffer.getvalue()


@router.get(
    "/export",
    summary="Download the raw samples behind a probability calculation",
    response_description="CSV or JSON of every historical day used, with source metadata.",
    responses={
        200: {
            "content": {"text/csv": {}, "application/json": {}},
            "description": "Attachment download.",
        }
    },
)
@limiter.limit(API_RATE_LIMIT)
async def export(
    request: Request,
    query: Annotated[AnalysisQuery, Depends(analysis_query)],
    format: Annotated[
        Literal["csv", "json"], Query(description="Output format.")
    ] = "csv",
) -> Response:
    """Return the exact rows that fed the probability engine.

    CSV carries provenance as `#` comment header lines; JSON carries it in a
    `metadata` object.
    """
    series, cache_hit = await power_client.get_series(query.lat, query.lon)
    sample = stats.collect_window(series, query.month, query.day, query.window)
    metadata = stats.build_metadata(
        series=series,
        sample=sample,
        requested_lat=query.lat,
        requested_lon=query.lon,
        month=query.month,
        day=query.day,
        window=query.window,
        cache_hit=cache_hit,
    )
    rows = _build_rows(sample)

    filename = (
        f"orbitwx_{query.lat:.2f}_{query.lon:.2f}_{query.month}-{query.day}.{format}"
    )
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    if format == "csv":
        return Response(
            content=_csv_body(rows, metadata),
            media_type="text/csv; charset=utf-8",
            headers=headers,
        )

    payload = {
        "metadata": metadata,
        "thresholds": query.thresholds,
        "columns": list(EXPORT_COLUMNS),
        "row_count": len(rows),
        "rows": rows,
    }
    return Response(
        content=json.dumps(payload, indent=2, allow_nan=False),
        media_type="application/json",
        headers=headers,
    )
