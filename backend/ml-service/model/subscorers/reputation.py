def parse_sentiment(value):
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        mapping = {
            "positive": 1.0,
            "mostly_positive": 0.5,
            "neutral": 0.0,
            "mixed": 0.0,
            "mostly_negative": -0.5,
            "negative": -1.0,
        }
        return mapping.get(value.strip().lower(), 0.0)

    return 0.0


"""Reputation sub-scorer: Glassdoor rating + Reddit sentiment blend."""
def score(payload, features, scraped, ctx=None):
    rep = (scraped or {}).get("reputation") or {}
    comp = (scraped or {}).get("composites") or {}

    if "overall_reputation_score" in comp:
        s = comp["overall_reputation_score"]
        status = "Positive" if s >= 70 else ("Mixed" if s >= 40 else "Negative")
        return {"score": s, "status": status,
                "evidence": f"Deep Think composite reputation score {s:.1f}/100 based on {rep.get('review_count', 0)} reviews."}

    glassdoor = float(rep.get("glassdoor", 0) or 0)  # 0..5
    sentiment = parse_sentiment(rep.get("reddit_sentiment"))  # -1..1
    mentions = int(rep.get("mentions", 0) or 0)
    review_count = int(rep.get("review_count", 0) or 0)
    hits = rep.get("hits", []) or []

    if glassdoor == 0 and review_count == 0:
        return {"score": 55, "status": "Low signal", "evidence": "No public reputation data."}

    g_score = (glassdoor / 5.0) * 100 if glassdoor else 55
    s_score = ((sentiment + 1) / 2.0) * 100
    blended = int(round(0.6 * g_score + 0.4 * s_score))
    status = "Positive" if blended >= 70 else ("Mixed" if blended >= 40 else "Negative")
    evidence = f"Glassdoor {glassdoor:.1f}/5 across {mentions} mentions, sentiment {sentiment:+.2f}."
    if review_count > 0:
        evidence += f" {review_count} review sources found."
    if hits:
        evidence += f" Latest: {hits[0].get('snippet', hits[0].get('description', ''))[:100]}..."
    return {"score": blended, "status": status, "evidence": evidence}
