"""Map enriched seed → ScoringPipeline input, and pipeline output → report DTO."""
from __future__ import annotations
from typing import Any


def to_score_payload(seed: dict[str, Any], scraped: dict[str, Any], deep_think: bool) -> dict[str, Any]:
    return {
        "title": seed.get("title", ""),
        "company": seed.get("company", ""),
        "source": seed.get("source_url", ""),
        "description": seed.get("description", ""),
        "salary": seed.get("salary", ""),
        "scraped": scraped,
        "deep_think": deep_think,
    }


def to_report(seed: dict[str, Any], scoring_result: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": seed.get("title", ""),
        "company": seed.get("company", ""),
        "source": seed.get("source_url", ""),
        "description": seed.get("description", ""),
        "trustScore": scoring_result.get("trustScore"),
        "band": scoring_result.get("band"),
        "reason": scoring_result.get("reason"),
        "parameters": scoring_result.get("parameters", []),
        "modelVersion": scoring_result.get("modelVersion"),
        "citations": seed.get("citations", []),
        "deepThink": scoring_result.get("deepThink", False),
    }