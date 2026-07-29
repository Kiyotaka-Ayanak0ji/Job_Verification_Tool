"""Cross-source posting consistency."""
def score(payload, features, scraped, ctx=None):
    con = (scraped or {}).get("consistency") or {}
    sources = int(con.get("sources", 1) or 1)
    title_sim = float(con.get("title_similarity", 1.0) or 1.0)  # 0..1
    salary_match = bool(con.get("salary_match", True))
    if sources < 2:
        return {"score": 60, "status": "Single source", "evidence": "Only observed on one board."}
    s = int(round(title_sim * 100)) - (0 if salary_match else 20)
    s = max(0, min(100, s))
    status = "Consistent" if s >= 70 else "Divergent"
    return {"score": s, "status": status,
            "evidence": f"{sources} sources; title similarity {title_sim:.2f}; salary {'matches' if salary_match else 'differs'}."}
