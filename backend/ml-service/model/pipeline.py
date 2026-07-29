"""End-to-end scoring pipeline: extractor -> subscorers -> meta -> band."""
from __future__ import annotations
from pathlib import Path
from datetime import datetime, timezone
import random

from .features import FeatureExtractor
from .subscorers import REGISTRY
from .meta import MetaScorer, SUB_KEYS
from .bands import band_for, reason_for
from .registry import ModelRegistry
from . import deep_think

# Spec §2.3 promotion gate — accuracy must clear this to become active.
ACCURACY_GATE = 0.95


class ScoringPipeline:
    def __init__(self, meta: MetaScorer, jd_pipe=None, version: str = "v0.0.0"):
        self.meta = meta
        self.jd_pipe = jd_pipe
        self.version = version
        self.extractor = FeatureExtractor()

    @classmethod
    def load(cls, models_root="models", version=None):
        reg = ModelRegistry(models_root)
        vdir, artifacts, manifest = (
            reg.load_version(version) if version else reg.load_active()
        )
        meta = artifacts["meta"]
        if not isinstance(meta, MetaScorer):
            meta = MetaScorer(clf=meta, calibrator=artifacts.get("calibrator"))
        return cls(meta=meta, jd_pipe=artifacts.get("jd"), version=manifest.get("version", vdir.name))

    def save(self, models_root, version, metrics=None, promote=True):
        reg = ModelRegistry(models_root)
        artifacts = {"meta": self.meta}
        if self.jd_pipe is not None:
            artifacts["jd"] = self.jd_pipe
        manifest = {
            "version": version,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "sub_keys": SUB_KEYS,
            "metrics": metrics or {},
            "promoted": False,
        }
        vdir = reg.save(version, artifacts, manifest)
        if promote:
            reg.promote(version)
            self.version = version
        else:
            reg.prune()  # eagerly drop rejected artifacts if beyond retention
        return vdir

    def _score(self, payload, scraped):
        features = self.extractor.transform(payload)
        ctx = {"jd_pipe": self.jd_pipe}
        parameters, sub_scores = [], {}
        for key, (mod, label, weight) in REGISTRY.items():
            r = mod.score(payload, features, scraped or {}, ctx)
            sub_scores[key] = r["score"]
            parameters.append({
                "key": key, "label": label, "weight": weight,
                "score": r["score"], "status": r["status"], "evidence": r["evidence"],
            })
        total = self.meta.predict_score(sub_scores)
        b = band_for(total)
        return {
            "modelVersion": self.version,
            "trustScore": total,
            "band": b,
            "reason": reason_for(b, parameters),
            "parameters": parameters,
        }

    def score(self, payload, scraped=None, noise=False):
        out = self._score(payload, scraped)
        if noise:
            _apply_noise(out)
        return out

    def deep_think_score(self, payload, scraped=None, noise=False):
        enriched = deep_think.enrich(payload, scraped or {})
        out = self._score(payload, enriched)
        out["deepThink"] = True
        if noise:
            _apply_noise(out, sigma=1.5)  # tighter noise for Deep Think
        return out


def _apply_noise(out, sigma=3.0):
    """Small Gaussian noise so repeat inputs don't return identical scores.

    Deep Think uses a tighter sigma so it stays strictly closer to the truth
    than Normal mode (spec §2.2).
    """
    base = int(out.get("trustScore", 0))
    jitter = int(round(random.gauss(0, sigma)))
    new = max(0, min(100, base + jitter))
    out["trustScore"] = new
    from .bands import band_for as _band
    out["band"] = _band(new)
