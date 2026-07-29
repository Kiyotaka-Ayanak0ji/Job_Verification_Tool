"""Enrichment layer with Firecrawl fallback (spec §3).

Attempts MCA-style Indian company lookup; when unavailable, falls back to
Firecrawl web search over Reddit, Glassdoor, Google (news) to aggregate
reputation and complaint signals from the open web.
"""
from __future__ import annotations
import re
from typing import Any
from urllib.parse import urlparse

from .firecrawl_client import search as fc_search

AGGREGATOR_HOSTS = ("linkedin.com", "naukri.com", "indeed.com", "glassdoor.com",
                    "crunchbase.com", "ambitionbox.com")

# 1-in-N verify-company calls force a fresh enrichment; this in-process
# cache serves the other N-1 to keep the variance behavior cheap.
_CACHE: dict[str, dict] = {}


def _domain_from(url: str) -> str:
    host = urlparse(url or "").hostname or ""
    host = host.replace("www.", "")
    if any(a in host for a in AGGREGATOR_HOSTS):
        return ""
    return host


def _try(name, fn, sources):
    try:
        out = fn()
        sources[name] = "ok"
        return out
    except Exception as e:
        sources[name] = f"error:{type(e).__name__}"
        return None


def _mca_lookup(company: str) -> dict:
    """Stubbed MCA lookup — returns {'status':'unknown'} for non-Indian names
    or when the CIN database is unreachable. Triggers fallback path.
    """
    return {"status": "unknown", "cin": None}


def _firecrawl_reputation(company: str) -> dict:
    """Fallback reputation signals via Firecrawl web search."""
    if not company:
        return {"glassdoor_rating": None, "reddit_sentiment": None, "review_count": 0, "source": "none"}
    hits = []
    for query in (
        f"{company} glassdoor reviews",
        f"{company} reddit reviews",
        f"{company} company reviews",
    ):
        res = fc_search(query, limit=5) or {}
        for d in (res.get("data") or []):
            hits.append({
                "url": d.get("url"),
                "title": d.get("title"),
                "description": d.get("description") or (d.get("markdown") or "")[:400],
            })
    text = " ".join((h.get("description") or "") + " " + (h.get("title") or "") for h in hits).lower()
    negative = sum(text.count(t) for t in ("scam", "fake", "avoid", "worst", "fraud"))
    positive = sum(text.count(t) for t in ("great", "excellent", "recommend", "loved", "best place"))
    sentiment = "positive" if positive > negative else "negative" if negative > positive else "neutral"
    return {
        "glassdoor_rating": None,
        "reddit_sentiment": sentiment,
        "review_count": len(hits),
        "mentions": len(hits),
        "hits": hits[:6],
        "source": "firecrawl",
    }


def _firecrawl_complaints(company: str) -> dict:
    if not company:
        return {"count": 0, "cybercrime_complaint_flag": False, "regulatory_adverse_signal": False, "fraud_allegation_count": 0}
    res = fc_search(f"{company} scam OR fraud OR complaint", limit=5) or {}
    data = res.get("data") or []
    text = " ".join((d.get("title") or "") + " " + (d.get("description") or "") for d in data).lower()
    return {
        "count": len(data),
        "cybercrime_complaint_flag": "cybercrime" in text or "police" in text,
        "regulatory_adverse_signal": "sebi" in text or "mca" in text or "rbi" in text,
        "fraud_allegation_count": text.count("fraud") + text.count("scam"),
    }


def enrich(seed, force_fresh: bool = False):
    key = (seed.get("company") or "") + "|" + (seed.get("source_url") or "")
    if not force_fresh and key in _CACHE:
        return _CACHE[key]

    sources: dict[str, str] = {}
    company = seed.get("company", "")
    url = seed.get("source_url") or ""
    corp_domain = _domain_from(url)

    mca = _try("mca", lambda: _mca_lookup(company), sources) or {}
    gstin = _try("gstin", lambda: {"status": "unknown", "gstin": None}, sources) or {}

    # Fallback path: MCA said "unknown" (non-Indian or offline) — pull open-web signals.
    if (mca.get("status") == "unknown"):
        reputation = _try("reputation_fallback", lambda: _firecrawl_reputation(company), sources) or {}
        complaint_res = _try("complaints_fallback", lambda: _firecrawl_complaints(company), sources) or {}
    else:
        reputation = {"glassdoor_rating": None, "reddit_sentiment": None, "review_count": 0, "mentions": 0}
        complaint_res = {"count": 0}

    domain_data = _try("domain", lambda: {
        "age_days": 365 * 5 if corp_domain else 0,
        "recruiter_matches_company": bool(corp_domain),
        "corp_domain": corp_domain,
    }, sources) or {}
    consistency = _try("consistency", lambda: {"cross_platform_matches": 1 if url else 0}, sources) or {}
    financial = _try("financial", lambda: {"funding_stage": "unknown", "headcount_yoy": None}, sources) or {}
    complaints = _try(
        "complaints",
        lambda: {
            "count": _count_scam_signals(company, seed.get("description", "")) + complaint_res.get("count", 0),
            "cybercrime_complaint_flag": complaint_res.get("cybercrime_complaint_flag", False),
            "regulatory_adverse_signal": complaint_res.get("regulatory_adverse_signal", False),
            "fraud_allegation_count": complaint_res.get("fraud_allegation_count", 0),
        },
        sources,
    ) or {}
    if seed.get("offline"):
        sources["firecrawl"] = "offline"

    out = {
        "mca": mca, "gstin": gstin, "reputation": reputation, "domain": domain_data,
        "consistency": consistency, "financial": financial, "complaints": complaints,
        "sources": sources,
    }
    _CACHE[key] = out
    return out


def _count_scam_signals(company: str, description: str) -> int:
    text = f"{company} {description}".lower()
    triggers = ["upfront fee", "training deposit", "processing fee", "mlm", "pyramid", "wire transfer"]
    return sum(1 for t in triggers if t in text)
