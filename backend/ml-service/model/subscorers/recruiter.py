"""Recruiter email verification and spoofing detection."""
def score(payload, features, scraped, ctx=None):
    rv = (scraped or {}).get("recruiter_verification") or {}

    match = bool(rv.get("email_domain_match", False))
    risk = rv.get("spoofing_risk", "unknown")

    if not rv or rv.get("source") == "none":
        return {"score": 55, "status": "No data", "evidence": "No recruiter email provided for verification."}

    if risk == "low" and match:
        return {"score": 95, "status": "Verified", "evidence": f"Recruiter email domain matches company domain ({rv.get('email_domain')})."}
    elif risk == "medium" or not match:
        return {"score": 30, "status": "Suspicious", "evidence": f"Recruiter email domain ({rv.get('email_domain')}) does not match known company domains: {', '.join(rv.get('company_domains_found', [])[:3])}."}
    else:
        return {"score": 55, "status": "Unverified", "evidence": f"Recruiter email domain: {rv.get('email_domain')}; company domains found: {', '.join(rv.get('company_domains_found', [])[:3]) or 'none'}."}