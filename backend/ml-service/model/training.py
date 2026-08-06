"""Train / retrain routines. Warm-starts from active model when possible."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split

from .meta import MetaScorer, SUB_KEYS, SPEC_WEIGHTS
from .pipeline import ScoringPipeline, ACCURACY_GATE
from .evaluation import evaluate
from .feedback_sentiment import soft_label


def load_jd_seed(path: str | Path) -> tuple[list[str], list[int]]:
    X, y = [], []
    for line in Path(path).read_text().splitlines():
        if not line.strip(): continue
        row = json.loads(line)
        X.append(row["text"]); y.append(int(row["label"]))  # 1 = clean, 0 = scam
    return X, y


def train_jd_classifier(seed_path: str | Path) -> Pipeline:
    X, y = load_jd_seed(seed_path)
    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=5000, sublinear_tf=True)),
        ("clf",   LogisticRegression(max_iter=1000, C=2.0)),
    ])
    pipe.fit(X, y)
    return pipe


def train_seed(models_root: str | Path, seed_path: str | Path, version: str = "v2.4.1") -> ScoringPipeline:
    """Cold-start: build the meta scorer + JD classifier from the seed dataset."""
    jd_pipe = train_jd_classifier(seed_path)
    meta = MetaScorer.seed()
    pipeline = ScoringPipeline(meta=meta, jd_pipe=jd_pipe, version=version)

    # sanity metrics on synthetic distribution
    rng = np.random.default_rng(7)
    X = rng.integers(0, 101, size=(500, 9)).astype(float)
    y = ((X * SPEC_WEIGHTS).sum(axis=1) >= 70).astype(int)
    preds = np.array([meta.predict_score(dict(zip(SUB_KEYS, row))) >= 70 for row in X], dtype=int)
    metrics = evaluate(y, preds)

    pipeline.save(models_root, version, metrics=metrics)
    return pipeline


def retrain_from_feedback(models_root: str | Path, feedback_rows: list[dict],
                          seed_path: str | Path, bump: str = "patch") -> tuple[ScoringPipeline, dict]:
    """Warm-start refit. `feedback_rows` = [{sub_scores:{...}, label:0|1, jd_text:str?, jd_label:int?}]"""
    active = ScoringPipeline.load(models_root)
    # rebuild meta from feedback
    X, y, soft = [], [], []
    jd_texts, jd_labels = [], []
    for r in feedback_rows:
        subs = r.get("sub_scores") or {}
        if not subs: continue
        X.append([subs.get(k, 50) for k in SUB_KEYS])
        y.append(int(r["label"]))
        soft.append(soft_label(r))
        if r.get("jd_text") is not None and r.get("jd_label") is not None:
            jd_texts.append(r["jd_text"]); jd_labels.append(int(r["jd_label"]))

    metrics = {"n_feedback": len(y), "n_soft_positive": sum(1 for s in soft if s >= 0.7)}
    if len(y) >= 20 and len(set(y)) == 2:
        Xa, ya = np.array(X, dtype=float), np.array(y, dtype=int)
        # Sample weight = confidence in the soft label (distance from 0.5).
        sw = np.array([abs(s - 0.5) * 2 + 0.1 for s in soft], dtype=float)
        Xtr, Xte, ytr, yte = train_test_split(Xa, ya, test_size=0.2, random_state=1, stratify=ya)
        # refit only knows (X, y); pass full arrays weighted where possible.
        active.meta.refit(Xtr, ytr)
        preds = np.array([active.meta.predict_score(dict(zip(SUB_KEYS, row))) >= 70 for row in Xte], dtype=int)
        metrics.update(evaluate(yte, preds))
        # Silence unused sample-weight vector until MetaScorer.refit supports it
        _ = sw

    if len(jd_labels) >= 40 and len(set(jd_labels)) == 2:
        seed_X, seed_y = load_jd_seed(seed_path)
        all_X = seed_X + jd_texts
        all_y = seed_y + jd_labels
        pipe = Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=5000, sublinear_tf=True)),
            ("clf",   LogisticRegression(max_iter=1000, C=2.0)),
        ]).fit(all_X, all_y)
        active.jd_pipe = pipe

    # version bump
    parts = active.version.lstrip("v").split(".")
    while len(parts) < 3: parts.append("0")
    maj, mn, pt = int(parts[0]), int(parts[1]), int(parts[2])
    if bump == "major":   maj, mn, pt = maj + 1, 0, 0
    elif bump == "minor": mn, pt = mn + 1, 0
    else:                 pt += 1
    new_version = f"v{maj}.{mn}.{pt}"
    # Promotion gate (spec §2.3): only replace the active model when
    # accuracy clears ACCURACY_GATE. Otherwise persist the artifact as an
    # unpromoted candidate so the audit trail is preserved.
    accuracy = float(metrics.get("accuracy", 0.0) or 0.0)
    promote = accuracy >= ACCURACY_GATE
    active.save(models_root, new_version, metrics=metrics, promote=promote)
    metrics["promoted"] = promote
    metrics["accuracy_gate"] = ACCURACY_GATE
    return active, metrics
