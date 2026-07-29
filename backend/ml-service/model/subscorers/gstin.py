"""GSTIN sub-scorer with checksum validation."""
import re
GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$")

def _valid_checksum(g: str) -> bool:
    if not GSTIN_RE.match(g):
        return False
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    factor, total = 1, 0
    for ch in g[:-1]:
        v = chars.index(ch) * factor
        total += (v // 36) + (v % 36)
        factor = 2 if factor == 1 else 1
    check = (36 - (total % 36)) % 36
    return chars[check] == g[-1]

def score(payload, features, scraped, ctx=None):
    gst = (scraped or {}).get("gstin") or {}
    number = gst.get("number")
    if number and _valid_checksum(number):
        return {"score": 92, "status": "Valid GSTIN", "evidence": f"GSTIN {number} passes checksum."}
    if number:
        return {"score": 15, "status": "Invalid GSTIN", "evidence": f"GSTIN {number} fails checksum."}
    return {"score": 50, "status": "Not provided", "evidence": "No GSTIN on record."}
