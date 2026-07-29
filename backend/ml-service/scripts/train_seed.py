"""Cold-start training entrypoint.

Usage: python scripts/train_seed.py [--version vX.Y.Z]
Writes artifacts to backend/ml-service/models/<version>/ and promotes it.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from model.training import train_seed  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v2.4.1")
    ap.add_argument("--models", default=str(ROOT / "models"))
    ap.add_argument("--seed",   default=str(ROOT / "model" / "data" / "jd_seed.jsonl"))
    args = ap.parse_args()

    pipe = train_seed(args.models, args.seed, version=args.version)
    print(f"Trained {pipe.version} → {args.models}/active")


if __name__ == "__main__":
    main()
