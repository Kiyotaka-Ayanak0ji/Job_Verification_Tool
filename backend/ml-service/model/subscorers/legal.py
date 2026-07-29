"""MCA registration sub-scorer (rule-based over scraper output)."""
def score(payload, features, scraped, ctx=None):
    mca = (scraped or {}).get("mca") or {}
    if mca.get("status") == "active":
        s = 95
        return {"score": s, "status": "Active CIN", "evidence": f"CIN {mca.get('cin','?')} active on MCA."}
    if mca.get("status") == "struck-off":
        return {"score": 5, "status": "Struck off", "evidence": "MCA marks entity as struck off."}
    if mca.get("status") == "dormant":
        return {"score": 40, "status": "Dormant", "evidence": "Entity dormant on MCA."}
    # unknown: derive from company-name plausibility
    company = features.get("company_norm", "")
    baseline = 55 if company else 30
    return {"score": baseline, "status": "Unverified",
            "evidence": "No MCA record retrieved; treat as unverified."}
