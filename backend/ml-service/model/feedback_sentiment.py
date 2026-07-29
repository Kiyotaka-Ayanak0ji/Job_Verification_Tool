"""Lightweight sentiment scoring for admin/free-text feedback.

No external NLP deps — we combine a hand-tuned lexicon with review-tag
overrides so the pipeline stays deterministic and works offline.

Returns a value in [0, 1]: 1 = strong positive (supports "accurate"),
0 = strong negative (supports "inaccurate"), 0.5 = neutral / unknown.
"""
from __future__ import annotations
import re

POS = {
    "accurate", "correct", "legit", "genuine", "trustworthy", "verified",
    "matches", "consistent", "clean", "reliable", "helpful", "great", "good",
    "spot on", "confirmed",
}
NEG = {
    "wrong", "scam", "fake", "fraud", "misleading", "inaccurate", "phishing",
    "sketchy", "suspicious", "bad", "poor", "off", "unreliable", "spam",
    "hallucinated", "incorrect",
}
REVIEW_TAG_MAP = {"positive": 0.85, "moderate": 0.5, "negative": 0.15}


def sentiment(text: str | None) -> float | None:
    if not text:
        return None
    t = text.lower()
    pos = sum(1 for w in POS if re.search(rf"\b{re.escape(w)}\b", t))
    neg = sum(1 for w in NEG if re.search(rf"\b{re.escape(w)}\b", t))
    if pos == 0 and neg == 0:
        return None
    total = pos + neg
    return round(pos / total, 3)


def soft_label(row: dict) -> float:
    """Blend hard label with rating + review + comment sentiment.

    Weights favor explicit accurate/inaccurate flag but pull toward user's
    numeric rating and sentiment when available.
    """
    hard = 1.0 if int(row.get("label", 0)) == 1 else 0.0
    signals = [(hard, 0.5)]
    r = row.get("user_rating")
    if isinstance(r, (int, float)) and 1 <= r <= 5:
        signals.append(((r - 1) / 4.0, 0.25))
    review = row.get("user_review")
    if review in REVIEW_TAG_MAP:
        signals.append((REVIEW_TAG_MAP[review], 0.15))
    s = sentiment(row.get("comment"))
    if s is not None:
        signals.append((s, 0.1))
    total_w = sum(w for _, w in signals)
    return round(sum(v * w for v, w in signals) / total_w, 4)