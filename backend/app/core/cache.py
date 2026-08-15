"""A tiny in-memory TTL + LRU cache.

orbitWx caches one entry per NASA POWER *grid cell* (not per exact coordinate),
so every search inside the same city reuses a single upstream fetch. Entries are
large (~11k days x 8 parameters), so the cache is deliberately bounded to keep
the service comfortably inside Render's 512 MB free tier.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Thread-safe LRU cache with per-entry time-to-live."""

    def __init__(self, ttl_seconds: int, max_entries: int) -> None:
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        self._store: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> T | None:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self.misses += 1
                return None
            expires_at, value = entry
            if expires_at < now:
                del self._store[key]
                self.misses += 1
                return None
            self._store.move_to_end(key)  # mark as most-recently used
            self.hits += 1
            return value

    def set(self, key: str, value: T) -> None:
        with self._lock:
            self._store[key] = (time.monotonic() + self._ttl, value)
            self._store.move_to_end(key)
            while len(self._store) > self._max_entries:
                self._store.popitem(last=False)  # evict least-recently used

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self.hits = 0
            self.misses = 0

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)

    @property
    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "entries": len(self._store),
                "hits": self.hits,
                "misses": self.misses,
                "max_entries": self._max_entries,
            }
