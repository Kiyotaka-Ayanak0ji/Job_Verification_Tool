"""JD red-flag classifier. Uses a trained TF-IDF + LogReg if loaded, else rules."""
def score(payload, features, scraped, ctx=None):
    jd_pipe = (ctx or {}).get("jd_pipe")
    text = (payload.get("description") or "").strip()
    feats = features.get("jd", {})
    if jd_pipe and text:
        p_clean = float(jd_pipe.predict_proba([text])[0, 1])
        s = int(round(p_clean * 100))
    else:
        rf, urg, free = feats.get("red_flags", 0), feats.get("urgency", 0), feats.get("has_free_email", 0)
        penalty = min(80, rf * 15 + urg * 8 + free * 20)
        s = max(10, 90 - penalty)
    status = "Clean" if s >= 70 else ("Suspicious" if s >= 40 else "Scam-like")
    evidence = (f"{feats.get('red_flags',0)} red-flag terms, "
                f"{feats.get('urgency',0)} urgency markers, "
                f"{'free-email contact' if feats.get('has_free_email') else 'corporate contact'}.")
    return {"score": s, "status": status, "evidence": evidence}
