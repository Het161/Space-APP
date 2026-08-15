"""Shared rate limiter.

Lives in its own module so routers can decorate endpoints without importing
``app.main`` (which would be circular).
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

#: Applied per-endpoint to /api/v1/* only — /health must stay freely pingable
#: so uptime crons can keep the Render free-tier instance warm.
limiter = Limiter(key_func=get_remote_address)

API_RATE_LIMIT = settings.rate_limit
