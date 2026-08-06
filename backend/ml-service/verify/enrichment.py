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
from .firecrawl_client import scrape as fc_scrape

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


def _gstin_lookup(company: str) -> dict:
    """Stubbed GSTIN lookup — placeholder for future integration."""
    return {"status": "unknown", "gstin": None}


def _firecrawl_company_info(company: str) -> dict:
    """Fetch company info via Firecrawl search for official site, about page, etc."""
    if not company:
        return {"official_site": None, "description": None, "linkedin": None, "source": "firecrawl"}
    queries = [
        f"{company} official website",
        f"{company} about us",
        f"{company} linkedin company page",
    ]
    results = {}
    for query in queries:
        res = fc_search(query, limit=3) or {}
        for d in (res.get("data") or []):
            url = d.get("url") or ""
            if "linkedin.com" in url and not results.get("linkedin"):
                results["linkedin"] = url
            elif results.get("official_site") is None and not any(a in url for a in AGGREGATOR_HOSTS):
                results["official_site"] = url
                results["description"] = d.get("description") or (d.get("markdown") or "")[:500]
    return {
        "official_site": results.get("official_site"),
        "description": results.get("description"),
        "linkedin": results.get("linkedin"),
        "source": "firecrawl"
    }


def _firecrawl_reputation(company: str) -> dict:
    """Fallback reputation signals via Firecrawl web search."""
    if not company:
        return {"glassdoor_rating": None, "reddit_sentiment": None, "review_count": 0, "source": "none"}
    hits = []
    for query in (
        f"{company} glassdoor reviews",
        f"{company} reddit reviews",
        f"{company} company reviews employee experience",
        f"{company} ambitionbox reviews",
    ):
        res = fc_search(query, limit=5) or {}
        for d in (res.get("data") or []):
            hits.append({
                "url": d.get("url"),
                "title": d.get("title"),
                "description": d.get("description") or (d.get("markdown") or "")[:400],
            })
    text = " ".join((h.get("description") or "") + " " + (h.get("title") or "") for h in hits).lower()
    negative = sum(text.count(t) for t in ("scam", "fake", "avoid", "worst", "fraud", "terrible", "awful", "toxic"))
    positive = sum(text.count(t) for t in ("great", "excellent", "recommend", "loved", "best place", "good culture", "work-life balance"))
    sentiment = "positive" if positive > negative else "negative" if negative > positive else "neutral"
    return {
        "glassdoor_rating": None,
        "reddit_sentiment": sentiment,
        "review_count": len(hits),
        "mentions": len(hits),
        "hits": hits[:8],
        "source": "firecrawl",
    }


def _firecrawl_recruiter_verification(company: str, recruiter_email: str = None) -> dict:
    """Verify recruiter email domain matches company and check for spoofing."""
    if not company and not recruiter_email:
        return {"email_domain_match": False, "spoofing_risk": "unknown", "source": "none"}

    try:
        # If we have recruiter email, check if domain matches company
        if recruiter_email and "@" in recruiter_email:
            email_domain = recruiter_email.split("@")[1].lower()
            # Search for company's official domain
            res = fc_search(f"{company} official email domain", limit=5) or {}
            domains = set()
            for d in (res.get("data") or []):
                text = (d.get("title") or "") + (d.get("description") or "")
                # Extract domains from text
                import re
                found = re.findall(r'[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
                domains.update(found)

            match = any(email_domain in d or d in email_domain for d in domains if d)
            return {
                "recruiter_email": recruiter_email,
                "email_domain": email_domain,
                "company_domains_found": list(domains)[:5],
                "email_domain_match": match,
                "spoofing_risk": "low" if match else "medium",
                "source": "firecrawl"
            }
    except Exception:
        pass

    return {"email_domain_match": False, "spoofing_risk": "unknown", "source": "firecrawl"}


def _firecrawl_job_posting_verification(job_title: str, company: str, source_url: str) -> dict:
    """Verify job posting consistency across platforms and check for red flags."""
    if not job_title and not company:
        return {"consistency_score": 0, "red_flags": [], "source": "none"}

    try:
        hits = []
        # Search for the same job posting on other platforms
        query = f'"{job_title}" "{company}" job'
        res = fc_search(query, limit=8) or {}
        for d in (res.get("data") or []):
            hits.append({
                "url": d.get("url"),
                "title": d.get("title"),
                "snippet": d.get("description") or (d.get("markdown") or "")[:300],
            })

        # Check for red flags in job postings
        text = " ".join((h.get("title") or "") + (h.get("snippet") or "") for h in hits).lower()
        red_flags = []
        red_flag_keywords = {
            "upfront_fee": ["upfront fee", "training deposit", "processing fee", "registration fee"],
            "mlm": ["mlm", "multi-level marketing", "network marketing", "pyramid"],
            "wire_transfer": ["wire transfer", "western union", "moneygram", "bitcoin payment"],
            "personal_info": ["ssn", "social security", "passport scan", "bank account details upfront"],
            "vague": ["work from home", "no experience needed", "unlimited earnings", "be your own boss"],
        }
        for flag, keywords in red_flag_keywords.items():
            if any(k in text for k in keywords):
                red_flags.append(flag)

        # Consistency: check if same job appears on multiple legitimate sites
        legit_sites = sum(1 for h in hits if h.get("url") and not any(a in h["url"] for a in AGGREGATOR_HOSTS[:4]))
        consistency_score = min(1.0, legit_sites / 3)  # Normalize to 0-1

        return {
            "consistency_score": consistency_score,
            "red_flags": red_flags,
            "platform_count": len(hits),
            "hits": hits[:6],
            "source": "firecrawl"
        }
    except Exception:
        return {"consistency_score": 0, "red_flags": [], "source": "firecrawl"}


def _firecrawl_complaints(company: str) -> dict:
    if not company:
        return {"count": 0, "cybercrime_complaint_flag": False, "regulatory_adverse_signal": False, "fraud_allegation_count": 0}
    res = fc_search(f"{company} scam OR fraud OR complaint OR police OR FIR", limit=8) or {}
    data = res.get("data") or []
    text = " ".join((d.get("title") or "") + " " + (d.get("description") or "") for d in data).lower()
    return {
        "count": len(data),
        "cybercrime_complaint_flag": "cybercrime" in text or "police" in text or "fir" in text,
        "regulatory_adverse_signal": "sebi" in text or "mca" in text or "rbi" in text or "ed " in text,
        "fraud_allegation_count": text.count("fraud") + text.count("scam") + text.count("cheating"),
        "hits": [{"url": d.get("url"), "title": d.get("title"), "snippet": (d.get("description") or "")[:200]} for d in data[:5]],
        "source": "firecrawl",
    }


def _firecrawl_domain_intelligence(domain: str) -> dict:
    """Get domain age, registrar, and other intelligence."""
    if not domain:
        return {"age_days": 0, "registrar": None, "source": "none"}
    try:
        res = fc_search(f"whois {domain} domain age registrar", limit=5) or {}
        data = res.get("data") or []
        text = " ".join((d.get("title") or "") + " " + (d.get("description") or "") for d in data).lower()
        # This is a simplified extraction - in production use a proper WHOIS API
        age_days = 0
        import re
        # Try to extract years from text
        year_matches = re.findall(r'(\d+)\s*years?\s*old', text)
        if year_matches:
            age_days = max(int(y) * 365 for y in year_matches)
        registrar = None
        for reg in ["godaddy", "namecheap", "cloudflare", "google domains", "amazon", "route53"]:
            if reg in text:
                registrar = reg
                break
        return {
            "age_days": age_days,
            "registrar": registrar,
            "source": "firecrawl"
        }
    except Exception:
        return {"age_days": 0, "registrar": None, "source": "firecrawl"}


def _count_scam_signals(company: str, description: str) -> int:
    text = f"{company} {description}".lower()
    triggers = ["upfront fee", "training deposit", "processing fee", "mlm", "pyramid", "wire transfer"]
    return sum(1 for t in triggers if t in text)


def enrich(seed, force_fresh: bool = False):
    key = (seed.get("company") or "") + "|" + (seed.get("source_url") or "")
    if not force_fresh and key in _CACHE:
        return _CACHE[key]

    sources: dict[str, str] = {}
    company = seed.get("company", "")
    url = seed.get("source_url") or ""
    job_title = seed.get("title", "")
    corp_domain = _domain_from(url)
    recruiter_email = seed.get("recruiter_email")

    mca = _try("mca", lambda: _mca_lookup(company), sources) or {}
    gstin = _try("gstin", lambda: _gstin_lookup(company), sources) or {}

    # Get company info via Firecrawl
    company_info = _try("company_info", lambda: _firecrawl_company_info(company), sources) or {}

    # Fallback path: MCA said "unknown" (non-Indian or offline) — pull open-web signals.
    if (mca.get("status") == "unknown"):
        reputation = _try("reputation_fallback", lambda: _firecrawl_reputation(company), sources) or {}
        complaint_res = _try("complaints_fallback", lambda: _firecrawl_complaints(company), sources) or {}
        recruiter_check = _try("recruiter_check", lambda: _firecrawl_recruiter_verification(company, recruiter_email), sources) or {}
        job_verification = _try("job_verification", lambda: _firecrawl_job_posting_verification(job_title, company, url), sources) or {}
        domain_intel = _try("domain_intel", lambda: _firecrawl_domain_intelligence(corp_domain), sources) or {}
    else:
        reputation = {"glassdoor_rating": None, "reddit_sentiment": None, "review_count": 0, "mentions": 0}
        complaint_res = {"count": 0}
        recruiter_check = {}
        job_verification = {}
        domain_intel = {}

    domain_data = _try("domain", lambda: {
        "age_days": domain_intel.get("age_days", 365 * 5 if corp_domain else 0),
        "recruiter_matches_company": bool(corp_domain) or recruiter_check.get("email_domain_match", False),
        "corp_domain": corp_domain,
        "registrar": domain_intel.get("registrar"),
    }, sources) or {}
    consistency = _try("consistency", lambda: {
        "cross_platform_matches": job_verification.get("platform_count", 1 if url else 0),
        "job_consistency_score": job_verification.get("consistency_score", 0),
        "job_red_flags": job_verification.get("red_flags", []),
    }, sources) or {}
    financial = _try("financial", lambda: {"funding_stage": "unknown", "headcount_yoy": None, "company_info": company_info}, sources) or {}
    complaints = _try(
        "complaints",
        lambda: {
            "count": _count_scam_signals(company, seed.get("description", "")) + complaint_res.get("count", 0),
            "cybercrime_complaint_flag": complaint_res.get("cybercrime_complaint_flag", False),
            "regulatory_adverse_signal": complaint_res.get("regulatory_adverse_signal", False),
            "fraud_allegation_count": complaint_res.get("fraud_allegation_count", 0),
            "complaint_hits": complaint_res.get("hits", []),
        },
        sources,
    ) or {}
    if seed.get("offline"):
        sources["firecrawl"] = "offline"

    out = {
        "mca": mca, "gstin": gstin, "reputation": reputation, "domain": domain_data,
        "consistency": consistency, "financial": financial, "complaints": complaints,
        "recruiter_verification": recruiter_check,
        "job_verification": job_verification,
        "company_info": company_info,
        "sources": sources,
    }
    _CACHE[key] = out
    return out