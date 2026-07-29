"""TrustHire ML service — Flask app.

Adds spec §2/§4 features:
  - GET  /models              list retained model versions (max 2)
  - POST /verify-company      supports model=, mode=fresh|noise, noise=bool
  - POST /bulk-csv            admin CSV upload (pandas) -> parsed rows
  - Automated retention & promotion gate (in pipeline.save / registry.prune)
"""
from __future__ import annotations
import io, json, os, threading
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, request, abort
from flask_cors import CORS

from model.pipeline import ScoringPipeline
from model.training import retrain_from_feedback
from model.meta import set_weights, ACTIVE_WEIGHTS, SUB_KEYS
from model.bands import set_thresholds, THRESHOLDS
from model.registry import ModelRegistry
from verify import resolve_input, enrich, to_score_payload, to_report

ROOT = Path(__file__).resolve().parent
MODELS_DIR = Path(os.environ.get("MODELS_DIR", ROOT / "models"))
SEED_PATH = Path(os.environ.get("SEED_PATH", ROOT / "model" / "data" / "jd_seed.jsonl"))
FEEDBACK_LOG = Path(os.environ.get("FEEDBACK_LOG", ROOT / "models" / "feedback.jsonl"))
API_KEY = os.environ.get("ML_SERVICE_API_KEY")

FEEDBACK_LOG.parent.mkdir(parents=True, exist_ok=True)

_lock = threading.Lock()
_pipelines: dict[str, ScoringPipeline] = {}


def get_pipeline(version: str | None = None) -> ScoringPipeline:
    key = version or "__active__"
    if key not in _pipelines:
        with _lock:
            if key not in _pipelines:
                _pipelines[key] = ScoringPipeline.load(MODELS_DIR, version=version)
    return _pipelines[key]


def _reset_cache():
    with _lock:
        _pipelines.clear()


def _require_key():
    if not API_KEY:
        return
    if request.headers.get("x-api-key") != API_KEY:
        abort(401, description="invalid or missing x-api-key")


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.get("/health")
    def health():
        try:
            v = get_pipeline().version
            return {"ok": True, "model": v}
        except FileNotFoundError as e:
            return {"ok": False, "error": str(e)}, 503

    @app.get("/models")
    def models():
        _require_key()
        rows = ModelRegistry(MODELS_DIR).list_models(promoted_only=True)
        return jsonify({"models": rows, "active": rows[0]["version"] if rows else None})

    @app.post("/score")
    def score():
        _require_key()
        payload = request.get_json(force=True, silent=True) or {}
        scraped = payload.pop("scraped", None)
        version = payload.pop("model", None)
        noise = bool(payload.pop("noise", False))
        return jsonify(get_pipeline(version).score(payload, scraped, noise=noise))

    @app.post("/score/deep-think")
    def score_deep():
        _require_key()
        payload = request.get_json(force=True, silent=True) or {}
        scraped = payload.pop("scraped", None)
        version = payload.pop("model", None)
        noise = bool(payload.pop("noise", False))
        return jsonify(get_pipeline(version).deep_think_score(payload, scraped, noise=noise))

    @app.post("/verify-company")
    def verify_company():
        _require_key()
        body = request.get_json(force=True, silent=True) or {}
        text = (body.get("input") or body.get("query") or "").strip()
        deep = bool(body.get("deepThink"))
        version = body.get("model") or None
        mode = (body.get("mode") or "").lower()   # "fresh" bypasses enrichment cache
        noise = bool(body.get("noise", False))
        if not text:
            return {"error": "input_required"}, 400
        try:
            seed = resolve_input(text)
        except Exception as e:
            return {"error": "resolve_failed", "detail": str(e)}, 502
        scraped = enrich(seed, force_fresh=(mode == "fresh"))
        payload = to_score_payload(seed, scraped, deep)
        pipe = get_pipeline(version)
        result = (pipe.deep_think_score(payload, scraped, noise=noise)
                  if deep else pipe.score(payload, scraped, noise=noise))
        result["deepThink"] = deep
        return jsonify(to_report(seed, result))

    @app.post("/feedback")
    def feedback():
        _require_key()
        body = request.get_json(force=True, silent=True) or {}
        row = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "job_id": body.get("job_id"),
            "user_id": body.get("user_id"),
            "verdict": body.get("verdict"),
            "sub_scores": body.get("sub_scores") or {},
            "label": 1 if body.get("verdict") == "accurate" else 0,
            "jd_text": body.get("jd_text"),
            "jd_label": body.get("jd_label"),
            "model_version": get_pipeline().version,
        }
        with FEEDBACK_LOG.open("a") as f:
            f.write(json.dumps(row) + "\n")
        return {"ok": True}

    @app.post("/retrain")
    def retrain():
        _require_key()
        bump = (request.args.get("bump") or "patch").lower()
        body = request.get_json(force=True, silent=True) or {}
        rows = body.get("rows") or (
            [json.loads(l) for l in FEEDBACK_LOG.read_text().splitlines() if l.strip()]
            if FEEDBACK_LOG.exists() else []
        )
        settings = body.get("settings") or {}
        if settings.get("weights"): set_weights(settings["weights"])
        if settings.get("thresholds"): set_thresholds(settings["thresholds"])
        pipe, metrics = retrain_from_feedback(MODELS_DIR, rows, SEED_PATH, bump=bump)
        _reset_cache()
        return {
            "ok": True,
            "version": pipe.version,
            "promoted": bool(metrics.get("promoted")),
            "metrics": metrics,
        }

    @app.post("/bulk-csv")
    def bulk_csv():
        """Parse an uploaded CSV (pandas) into a normalized list of rows.

        Accepts columns: `url` OR `company` (case-insensitive). Node then
        enqueues these into a BulkJob and processes them via the existing
        worker.
        """
        _require_key()
        f = request.files.get("file")
        if not f:
            return {"error": "file_required"}, 400
        try:
            df = pd.read_csv(io.BytesIO(f.read()))
        except Exception as e:
            return {"error": "csv_parse_failed", "detail": str(e)}, 400
        df.columns = [c.strip().lower() for c in df.columns]
        rows: list[dict] = []
        for _, r in df.iterrows():
            url = str(r.get("url") or r.get("link") or "").strip()
            company = str(r.get("company") or r.get("name") or "").strip()
            val = url or company
            if not val or val.lower() == "nan":
                continue
            rows.append({"input": val, "kind": "url" if url else "company"})
        return jsonify({"rows": rows, "count": len(rows)})

    @app.get("/settings")
    def get_settings():
        _require_key()
        return jsonify({
            "weights": {k: float(ACTIVE_WEIGHTS[i]) for i, k in enumerate(SUB_KEYS)},
            "thresholds": THRESHOLDS,
        })

    @app.post("/settings")
    def put_settings():
        _require_key()
        body = request.get_json(force=True, silent=True) or {}
        if body.get("weights"): set_weights(body["weights"])
        if body.get("thresholds"): set_thresholds(body["thresholds"])
        return jsonify({
            "weights": {k: float(ACTIVE_WEIGHTS[i]) for i, k in enumerate(SUB_KEYS)},
            "thresholds": THRESHOLDS,
        })

    @app.get("/metrics")
    def metrics():
        _, _, manifest = ModelRegistry(MODELS_DIR).load_active()
        return jsonify(manifest)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))
