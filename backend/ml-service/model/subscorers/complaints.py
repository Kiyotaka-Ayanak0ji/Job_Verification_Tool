def score(payload, features, scraped, ctx=None):
    c = (scraped or {}).get("complaints") or {}
    
    # Deep think logic uses a broader set of flags
    if "cybercrime_complaint_flag" in c:
        if c.get("cybercrime_complaint_flag") or c.get("regulatory_adverse_signal"):
            return {"score": 5, "status": "High Risk", "evidence": "Deep Think: Severe regulatory or cybercrime alerts found."}
        count = sum([
            int(c.get("complaint_count", 0)),
            int(c.get("fraud_allegation_count", 0)),
            int(c.get("recruitment_fee_allegation_count", 0)),
            int(c.get("salary_non_payment_allegation_count", 0))
        ])
    else:
        count = int(c.get("count", 0) or 0)

    if count == 0:
        return {"score": 94, "status": "None flagged", "evidence": "0 prior TrustHire flags."}
    s = max(5, 90 - count * 12)
    return {"score": s, "status": f"{count} flag(s)",
            "evidence": f"{count} prior user complaint(s) on this employer."}
