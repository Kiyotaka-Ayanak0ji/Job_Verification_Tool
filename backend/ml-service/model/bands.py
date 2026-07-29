"""Trust-score band thresholds + reason generator."""
from typing import Literal

Band = Literal["high", "likely", "caution", "risk"]

BAND_LABELS = {
    "high": "High Trust",
    "likely": "Likely Genuine",
    "caution": "Caution",
    "risk": "High Risk",
}

# Runtime-tunable thresholds; admin can override via /settings.
THRESHOLDS = {"high": 90, "likely": 70, "caution": 40}


def set_thresholds(t: dict) -> None:
    for k in ("high", "likely", "caution"):
        if k in t and isinstance(t[k], (int, float)):
            THRESHOLDS[k] = int(t[k])


def band_for(score: int) -> Band:
    if score >= THRESHOLDS["high"]: return "high"
    if score >= THRESHOLDS["likely"]: return "likely"
    if score >= THRESHOLDS["caution"]: return "caution"
    return "risk"

def reason_for(band: Band, subs: list[dict]) -> str:
    """Name the two lowest weight*score parameters as the primary drivers."""
    ranked = sorted(subs, key=lambda p: p["score"] * p["weight"])
    if band in ("caution", "risk"):
        drivers = ", ".join(p["label"] for p in ranked[:2])
        return f"Weak signals from {drivers}."
    if band == "likely":
        weak = ranked[0]
        return f"Overall signals align, minor concern on {weak['label']}."
    return "All signals align with a genuine posting."
