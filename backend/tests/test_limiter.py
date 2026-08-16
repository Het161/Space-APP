"""Rate-limit keying.

Regression cover for a production incident: behind Render's load balancer
``request.client.host`` is the *proxy's* address, identical for every visitor,
so the "per-IP" limit was really one global bucket — a single busy client
locked out everyone.
"""

from __future__ import annotations

import pytest
from starlette.requests import Request

from app.core.limiter import client_ip


def _request(headers: dict[str, str] | None = None, client: str = "10.0.0.7") -> Request:
    raw = [
        (key.lower().encode(), value.encode())
        for key, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "https",
            "path": "/api/v1/probability",
            "raw_path": b"/api/v1/probability",
            "query_string": b"",
            "headers": raw,
            "client": (client, 51234),
            "server": ("orbitwx", 443),
        }
    )


def test_falls_back_to_socket_address_without_a_proxy() -> None:
    """Local development has no X-Forwarded-For."""
    assert client_ip(_request(client="203.0.113.9")) == "203.0.113.9"


def test_uses_the_forwarded_client_address() -> None:
    """Behind one proxy, the header carries the real caller."""
    request = _request({"X-Forwarded-For": "198.51.100.4"}, client="10.0.0.7")
    assert client_ip(request) == "198.51.100.4"


def test_two_visitors_behind_one_proxy_get_different_keys() -> None:
    """The bug: both of these used to collapse onto the proxy's address."""
    first = client_ip(_request({"X-Forwarded-For": "198.51.100.4"}))
    second = client_ip(_request({"X-Forwarded-For": "203.0.113.77"}))
    assert first != second


def test_client_cannot_forge_the_key_by_prepending_entries() -> None:
    """Proxies append, so the rightmost hop is the one Render itself added."""
    spoofed = _request({"X-Forwarded-For": "1.2.3.4, 198.51.100.4"})
    assert client_ip(spoofed) == "198.51.100.4"


@pytest.mark.parametrize(
    "header",
    ["", "   ", ",", " , "],
)
def test_malformed_headers_fall_back_safely(header: str) -> None:
    request = _request({"X-Forwarded-For": header}, client="10.0.0.7")
    assert client_ip(request) == "10.0.0.7"


def test_whitespace_around_entries_is_stripped() -> None:
    request = _request({"X-Forwarded-For": "1.2.3.4 ,  198.51.100.4 "})
    assert client_ip(request) == "198.51.100.4"
