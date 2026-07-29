"""Feature extraction shared across sub-scorers and the meta model."""
import re
from typing import Any

RED_FLAG_LEXICON = [
    "upfront", "registration fee", "processing fee", "security deposit",
    "quick money", "work from home guaranteed", "no experience required",
    "earn lakhs", "immediate joining", "urgent hiring", "limited seats",
    "whatsapp", "telegram", "gmail.com", "yahoo.com",
    "mlm", "network marketing", "referral bonus",
]

URGENCY_MARKERS = ["urgent", "immediate", "today only", "last chance", "hurry", "!!!"]

SALARY_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:lpa|lakh|lac|k|crore|cr)?", re.I)


class FeatureExtractor:
    """Deterministic feature builder (no external state)."""

    def normalize_company(self, name: str) -> str:
        return re.sub(r"\s+(pvt\.?\s*ltd\.?|private\s+limited|inc\.?|llc|llp)$",
                      "", (name or "").strip().lower())

    def jd_features(self, description: str | None) -> dict[str, Any]:
        d = (description or "").lower()
        if not d:
            return {"length": 0, "red_flags": 0, "urgency": 0, "has_free_email": 0}
        red = sum(1 for w in RED_FLAG_LEXICON if w in d)
        urg = sum(1 for w in URGENCY_MARKERS if w in d)
        free_email = int(bool(re.search(r"@(gmail|yahoo|hotmail|outlook)\.", d)))
        return {"length": len(d), "red_flags": red, "urgency": urg, "has_free_email": free_email}

    def salary_features(self, salary: str | None) -> dict[str, float]:
        if not salary:
            return {"min": 0.0, "max": 0.0, "spread": 0.0}
        nums = [float(m.group(1).replace(",", "")) for m in SALARY_RE.finditer(salary)]
        if not nums:
            return {"min": 0.0, "max": 0.0, "spread": 0.0}
        lo, hi = min(nums), max(nums)
        return {"min": lo, "max": hi, "spread": hi - lo}

    def transform(self, payload: dict) -> dict[str, Any]:
        return {
            "company_norm": self.normalize_company(payload.get("company", "")),
            "jd": self.jd_features(payload.get("description")),
            "salary": self.salary_features(payload.get("salary")),
        }
