# orbitWx — Backend

FastAPI service that turns NASA POWER daily records into **climatological
probabilities** for a location + calendar date.

> This is not a forecast API. It answers *"historically, how often was it very
> hot / cold / windy / wet / uncomfortable here on this date?"*

---

## Quick start

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Interactive docs: <http://localhost:8000/docs>

Smoke test (Ahmedabad, mid-October):

```bash
curl "http://localhost:8000/api/v1/probability?lat=23.03&lon=72.58&month=10&day=15"
```

Run the test suite (never touches the live NASA API — httpx is mocked):

```bash
pytest
```

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/probability` | Five condition probabilities + rain tiers + trends + provenance |
| `GET` | `/api/v1/export` | Raw sample rows as CSV or JSON, with source attribution |
| `GET` | `/api/v1/best-days` | Smart Date Finder — every day of a month ranked by combined risk |
| `GET` | `/health` | Liveness + cache stats |

### Query parameters

| Param | Type | Notes |
|---|---|---|
| `lat` | float, −90…90 | Required |
| `lon` | float, −180…180 | Required |
| `month` | int, 1–12 | Required |
| `day` | int, 1–31 | Required (not for `/best-days`); impossible dates → `422` |
| `window` | int, 1–15 | Day-of-year half-window, default `7` |
| `hot_threshold` | float °C | Default `35` |
| `cold_threshold` | float °C | Default `5` |
| `wind_threshold` | float m/s | Default `10` |
| `wet_threshold` | float mm/day | Default `10` |
| `comfort_threshold` | float °C | Default `40` (heat index) |
| `format` | `csv` \| `json` | `/api/v1/export` only |

---

## Architecture

```
routers/      thin HTTP layer — validation, response models, rate limiting
services/
  nasa_power  POWER client: decade chunking, retries, grid-cell TTL cache
  statistics  sampling window, exceedance probabilities, percentiles, trends
  comfort     NOAA/Rothfusz heat index
core/
  cache       thread-safe TTL + LRU cache
  params      shared query-parameter validation
  limiter     slowapi rate limiter (shared to avoid a circular import)
models/       Pydantic v2 response schemas — the public API contract
```

### Performance notes

- **Decade chunking.** The 30-year range is split into three concurrent
  requests (`asyncio.gather`), roughly 3× faster than one 30-year call.
- **Grid-cell caching.** POWER serves a 0.5° × 0.625° grid, so coordinates are
  snapped to the cell before caching. Two searches in the same city share one
  upstream fetch. TTL 24 h, max 50 entries, LRU eviction.
- **Single-flight.** Concurrent requests for the same cell await one fetch
  instead of stampeding POWER.
- **No pandas.** numpy alone keeps the Render free-tier image small.

### Implementation notes

- `-999` is POWER's fill value. It is converted to `NaN` on parse and excluded
  from every statistic; the counts are reported in `metadata.fill_value_days`.
- Router modules deliberately omit `from __future__ import annotations`.
  FastAPI resolves string annotations against the *decorator's* module globals,
  which breaks `Depends()` lookups once slowapi wraps the endpoint.

---

## Deployment (Render, free tier)

`render.yaml` **at the repository root** is a ready blueprint (Render only looks
there by default; it sets `rootDir: backend` to build this package).
`ALLOWED_ORIGINS` already includes the deployed frontend.

The free tier sleeps after 15 minutes of inactivity and takes ~30–50 s to wake.
Optionally register a [cron-job.org](https://cron-job.org) job hitting `/health`
every 10 minutes to keep it warm — `/health` is intentionally exempt from rate
limiting for exactly this.

---

## Data attribution

Data obtained from the NASA Langley Research Center (LaRC) POWER Project funded
through the NASA Earth Science/Applied Science Program.
