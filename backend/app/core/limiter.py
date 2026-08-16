"""Shared rate limiter.

Lives in its own module so routers can decorate endpoints without importing
``app.main`` (which would be circular).
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import settings


def client_ip(request: Request) -> str:
    """The real caller's IP, as seen from behind Render's load balancer.

    slowapi's ``get_remote_address`` reads ``request.client.host``, which in a
    proxied deployment is the *proxy's* address — the same value for every
    visitor. Keying on that turns a "per-IP" limit into one global bucket, so a
    single busy client locks out the whole world.

    We therefore read ``X-Forwarded-For`` and take the **rightmost** entry.
    Proxies append as they forward, so the last hop is the one Render's own
    load balancer added: a client can prepend fake entries but cannot forge
    that one. (With several chained trusted proxies the leftmost entry is the
    usual choice, but Render fronts us with exactly one.)
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if hops:
            return hops[-1]
    return get_remote_address(request)


#: Applied per-endpoint to /api/v1/* only — /health must stay freely pingable
#: so uptime crons can keep the Render free-tier instance warm.
limiter = Limiter(key_func=client_ip)

API_RATE_LIMIT = settings.rate_limit
