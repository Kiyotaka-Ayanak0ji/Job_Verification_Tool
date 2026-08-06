def score(payload, features, scraped, ctx=None):
    c = (scraped or {}).get("complaints") or {}

    # Use new enrichment fields if available
    cybercrime_flag = c.get("cybercrime_complaint_flag", False)
    regulatory_flag = c.get("regulatory_adverse_signal", False)
    fraud_count = int(c.get("fraud_allegation_count", 0) or 0)
    total_count = int(c.get("count", 0) or 0)
    complaint_hits = c.get("complaint_hits", []) or []

    # Severe flags trigger immediate low score
    if cybercrime_flag or regulatory_flag:
        evidence_parts = []
        if cybercrime_flag:
            evidence_parts.append("cybercrime/police complaint flagged")
        if regulatory_flag:
            evidence_parts.append("regulatory adverse signal (SEBI/MCA/RBI/ED)")
        evidence = "Deep Think: Severe " + "; ".join(evidence_parts) + "."
        return {"score": 5, "status": "High Risk", "evidence": evidence}

    # Count total complaint signals
    count = total_count + fraud_count

    if count == 0:
        return {"score": 94, "status": "None flagged", "evidence": "0 prior TrustHire flags."}

    s = max(5, 90 - count * 12)
    status = f"{count} flag(s)"
    evidence = f"{count} prior complaint signal(s) on this employer."
    if complaint_hits:
        evidence += f" Latest: {complaint_hits[0].get('snippet', '')[:100]}..."
    return {"score": s, "status": status, "evidence": evidence}
