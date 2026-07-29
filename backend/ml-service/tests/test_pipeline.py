import json, os, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from model.training import train_seed
from model.pipeline import ScoringPipeline


def test_seed_train_and_score(tmp_path: Path):
    seed = Path(__file__).resolve().parents[1] / "model" / "data" / "jd_seed.jsonl"
    train_seed(tmp_path, seed, version="v0.0.1")
    pipe = ScoringPipeline.load(tmp_path)

    clean = pipe.score({
        "title": "Senior Backend Engineer",
        "company": "Acme Pvt Ltd",
        "description": "We are hiring a senior backend engineer with 5 years of Python experience.",
        "scraped": None,
    }, scraped={
        "mca": {"status": "active", "cin": "X"},
        "gstin": {"number": "29ABCDE1234F1Z5"},
        "reputation": {"glassdoor": 4.2, "reddit_sentiment": 0.4, "mentions": 30},
        "domain": {"age_days": 3000, "recruiter_matches_company": True},
        "consistency": {"sources": 3, "title_similarity": 0.95, "salary_match": True},
        "financial": {"headcount_growth": 0.1, "revenue_known": True},
        "complaints": {"count": 0},
    })
    scam = pipe.score({
        "title": "Work from home",
        "company": "Quick Cash",
        "description": "URGENT!!! Pay 2500 registration fee via whatsapp, earn lakhs, no experience.",
    }, scraped={
        "mca": {"status": "unknown"},
        "gstin": {},
        "reputation": {"glassdoor": 1.2, "reddit_sentiment": -0.6, "mentions": 4},
        "domain": {"age_days": 40, "recruiter_matches_company": False},
        "consistency": {"sources": 1},
        "financial": {"headcount_growth": -0.2, "revenue_known": False},
        "complaints": {"count": 3},
    })

    assert clean["trustScore"] > scam["trustScore"]
    assert clean["band"] in {"high", "likely"}
    assert scam["band"] in {"caution", "risk"}
    assert len(clean["parameters"]) == 8
