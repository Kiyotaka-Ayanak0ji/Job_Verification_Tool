"""Smoke tests for the verify orchestrator (offline / stubbed Firecrawl)."""
from verify import resolve_input, enrich, to_score_payload, to_report


def test_resolve_company_name_offline():
    seed = resolve_input("Acme Robotics")
    assert seed["company"] == "Acme Robotics"
    assert "citations" in seed


def test_enrich_flags_scam_language():
    seed = {"company": "Foo", "description": "Send upfront fee to secure your seat", "source_url": ""}
    scraped = enrich(seed)
    assert scraped["complaints"]["count"] >= 1


def test_mapper_round_trip():
    seed = {"title": "T", "company": "C", "source_url": "https://c.com", "citations": []}
    scraped = enrich(seed)
    payload = to_score_payload(seed, scraped, deep_think=False)
    assert payload["company"] == "C"
    report = to_report(seed, {"trustScore": 71, "band": "likely", "parameters": []})
    assert report["trustScore"] == 71 and report["citations"] == []