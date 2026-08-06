"""Cross-source posting consistency."""
def score(payload, features, scraped, ctx=None):
    con = (scraped or {}).get("consistency") or {}
    # New fields from enhanced enrichment
    cross_platform = int(con.get("cross_platform_matches", 0) or 0)
    job_consistency = float(con.get("job_consistency_score", 0) or 0)
    red_flags = con.get("job_red_flags", []) or []
    # Legacy fields
    sources = int(con.get("sources", cross_platform if cross_platform else 1) or 1)
    title_sim = float(con.get("title_similarity", job_consistency if job_consistency else 1.0) or 1.0)
    salary_match = bool(con.get("salary_match", True))

    # Start with base score
    if sources < 2 and cross_platform < 2:
        base_score = 60
        status = "Single source"
        evidence = "Only observed on one board."
    else:
        # Use job_consistency_score if available, otherwise derive from title_sim
        consistency_score = job_consistency * 100 if job_consistency > 0 else (title_sim * 100)
        # Apply red flag penalties
        penalty = len(red_flags) * 10
        s = max(0, min(100, int(round(consistency_score)) - penalty))
        base_score = s
        status = "Consistent" if s >= 70 else "Divergent"
        evidence = f"Cross-platform matches: {cross_platform}; job consistency score: {job_consistency:.2f}; red flags: {len(red_flags)} ({', '.join(red_flags) if red_flags else 'none'})"

    return {"score": base_score, "status": status, "evidence": evidence}
