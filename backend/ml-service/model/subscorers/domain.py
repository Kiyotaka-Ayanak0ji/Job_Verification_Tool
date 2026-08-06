"""Domain age + recruiter-email match."""
def score(payload, features, scraped, ctx=None):
    dom = (scraped or {}).get("domain") or {}
    # New fields from enhanced enrichment
    age_days = int(dom.get("age_days", 0) or 0)
    recruiter_match = bool(dom.get("recruiter_matches_company", False))
    registrar = dom.get("registrar")

    if age_days == 0:
        return {"score": 45, "status": "Unknown", "evidence": "No WHOIS data."}

    age_score = min(100, int(age_days / 3650 * 100 + 40))  # 10y = full
    penalty = 0 if recruiter_match else 25
    s = max(0, min(100, age_score - penalty))
    status = "Established" if s >= 70 else "Young / mismatch"
    reg_info = f"; registrar: {registrar}" if registrar else ""
    return {"score": s, "status": status,
            "evidence": f"Domain age {age_days}d{reg_info}; recruiter email {'matches' if recruiter_match else 'differs from'} company domain."}
