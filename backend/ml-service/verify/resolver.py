"""Resolve free-form user input into a structured job/company seed.

Accepts either a job URL or a bare company name. For URLs we scrape the
page and pull title/company/description. For names we run a Firecrawl
search and pick the best-looking corporate URL — preferring shortest
same-domain hits and demoting aggregator pages.
"""
from __future__ import annotations
import re
from typing import Any
from urllib.parse import urlparse
from . import firecrawl_client as fc

URL_RE = re.compile(r"^https?://", re.I)
AGGREGATOR_HOSTS = (
    "linkedin.com", "naukri.com", "indeed.com", "glassdoor.com",
    "crunchbase.com", "ambitionbox.com", "youtube.com", "facebook.com",
    "twitter.com", "x.com", "wikipedia.org",
)


def _extract_from_markdown(md: str, fallback_url: str) -> dict[str, Any]:
    lines = [ln.strip() for ln in (md or "").splitlines() if ln.strip()]
    title = next((ln.lstrip("# ").strip() for ln in lines if ln.startswith("#")), "Job posting")
    body = "\n".join(lines[:400])
    company_match = re.search(r"(?:at|@|company[:\-])\s+([A-Z][A-Za-z0-9&.\- ]{2,60})", body)
    company = company_match.group(1).strip() if company_match else _guess_company_from_url(fallback_url)
    return {"title": title[:180], "company": company, "description": body[:8000]}


def _guess_company_from_url(url: str) -> str:
    m = re.search(r"https?://(?:www\.)?([^/]+)", url or "")
    if not m:
        return "Unknown Company"
    host = m.group(1).split(".")
    return host[-2].capitalize() if len(host) >= 2 else host[0].capitalize()


def _score_hit(hit: dict, company: str) -> tuple[int, int]:
    """Lower score = better. (aggregator_penalty, url_length)."""
    url = hit.get("url") or ""
    host = (urlparse(url).hostname or "").replace("www.", "")
    penalty = 1 if any(a in host for a in AGGREGATOR_HOSTS) else 0
    # Prefer hits whose host contains a slug of the company name.
    slug = re.sub(r"[^a-z0-9]", "", (company or "").lower())
    if slug and slug in host.replace(".", ""):
        penalty -= 1  # boost same-brand hosts
    return (penalty, len(url))


def resolve_input(text: str) -> dict[str, Any]:
    t = (text or "").strip()
    if not t:
        raise ValueError("empty_input")

    citations: list[dict] = []
    if URL_RE.match(t):
        res = fc.scrape(t, formats=["markdown", "links"])
        md = (res.get("data") or {}).get("markdown") or res.get("markdown") or ""
        seed = _extract_from_markdown(md, t)
        seed["source_url"] = t
        citations.append({"title": seed["title"], "url": t})
        return {**seed, "citations": citations, "offline": res.get("offline", False)}

    # Company-name flow
    q = f'"{t}" company official site'
    res = fc.search(q, limit=8)
    hits = [h for h in (res.get("data") or []) if h.get("url")]
    hits.sort(key=lambda h: _score_hit(h, t))
    top = hits[0] if hits else {}
    seed = {
        "title": f"Company profile — {t}",
        "company": t,
        "description": top.get("description") or top.get("markdown") or f"Verification requested for {t}.",
        "source_url": top.get("url", ""),
    }
    for h in hits[:5]:
        citations.append({"title": (h.get("title") or h["url"])[:120], "url": h["url"]})
    return {**seed, "citations": citations, "offline": res.get("offline", False)}
