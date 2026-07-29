def score(payload, features, scraped, ctx=None):
    fin = (scraped or {}).get("financial") or {}
    comp = (scraped or {}).get("composites") or {}

    if "financial_stability_score" in comp:
        s = comp["financial_stability_score"]
        status = "Stable" if s >= 70 else ("Weak" if s < 40 else "Mixed")
        return {"score": s, "status": status,
                "evidence": f"Deep Think financial stability score {s:.1f}/100 based on extensive MCA filings."}

    growth = float(fin.get("headcount_growth", 0) or 0)  # -1..1
    revenue_known = bool(fin.get("revenue_known", False))
    base = 60 + int(growth * 30)
    if revenue_known:
        base += 10
    s = max(10, min(100, base))
    status = "Stable" if s >= 70 else ("Weak" if s < 40 else "Mixed")
    return {"score": s, "status": status,
            "evidence": f"Headcount trend {growth:+.1%}; revenue {'disclosed' if revenue_known else 'undisclosed'}."}
