"""Firecrawl client with retry, in-process cache, and offline stub.

Talks directly to the Firecrawl v1 REST API using FIRECRAWL_API_KEY.
When the key is missing (local dev / CI without network) the client returns
a benign offline stub so the scoring pipeline stays runnable end-to-end.
"""
from __future__ import annotations
import os
import time
from typing import Any, Optional
import requests

BASE = os.environ.get("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev/v1")
TIMEOUT = 30
_CACHE_TTL = 600  # seconds
_cache: dict[str, tuple[float, dict]] = {}


def _headers() -> Optional[dict]:
    fk = os.environ.get("FIRECRAWL_API_KEY")
    if not fk:
        return None
    return {"Content-Type": "application/json", "Authorization": f"Bearer {fk}"}


def _cached(key: str) -> Optional[dict]:
    hit = _cache.get(key)
    if not hit:
        return None
    exp, value = hit
    if time.time() > exp:
        _cache.pop(key, None)
        return None
    return value


def _store(key: str, value: dict) -> None:
    _cache[key] = (time.time() + _CACHE_TTL, value)


def _post_with_retry(path: str, body: dict) -> dict[str, Any]:
    h = _headers()
    if not h:
        return {"success": False, "offline": True, "data": {}}
    delays = [1, 2, 4]
    last_err = None
    for i in range(3):
        try:
            r = requests.post(f"{BASE}{path}", headers=h, json=body, timeout=TIMEOUT)
            if r.status_code in (429, 500, 502, 503, 504) and i < len(delays):
                time.sleep(delays[i])
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last_err = e
            if i < len(delays):
                time.sleep(delays[i])
                continue
    return {"success": False, "offline": True, "data": {}, "error": str(last_err) if last_err else "unknown"}


def scrape(url: str, formats: Optional[list[str]] = None) -> dict[str, Any]:
    key = f"scrape::{url}::{','.join(formats or ['markdown'])}"
    hit = _cached(key)
    if hit is not None:
        return hit
    out = _post_with_retry("/scrape", {"url": url, "formats": formats or ["markdown"], "onlyMainContent": True})
    _store(key, out)
    return out


def search(query: str, limit: int = 8) -> dict[str, Any]:
    key = f"search::{query}::{limit}"
    hit = _cached(key)
    if hit is not None:
        return hit
    out = _post_with_retry("/search", {"query": query, "limit": limit})
    _store(key, out)
    return out
