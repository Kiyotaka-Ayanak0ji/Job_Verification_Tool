"""Warm-start retrain from a JSONL of feedback rows.

Row shape: {"sub_scores": {...}, "label": 0|1, "jd_text": "...", "jd_label": 0|1}
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from model.training import retrain_from_feedback  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--feedback", required=True)
    ap.add_argument("--models",   default=str(ROOT / "models"))
    ap.add_argument("--seed",     default=str(ROOT / "model" / "data" / "jd_seed.jsonl"))
    ap.add_argument("--bump",     choices=["major", "minor", "patch"], default="patch")
    args = ap.parse_args()

    rows = [json.loads(l) for l in Path(args.feedback).read_text().splitlines() if l.strip()]
    pipe, metrics = retrain_from_feedback(args.models, rows, args.seed, bump=args.bump)
    print(f"Promoted {pipe.version}  metrics={metrics}")


if __name__ == "__main__":
    main()
