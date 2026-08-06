"""Meta scorer: LogisticRegression over 9 sub-scores → P(authentic) → 0-100.

Initialised to the PDF spec weights; refit from feedback via training.py.
"""
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression

SUB_KEYS = ["legal", "gstin", "reputation", "domain", "jd", "consistency", "financial", "complaints", "recruiter"]
SPEC_WEIGHTS = np.array([0.15, 0.10, 0.15, 0.10, 0.15, 0.10, 0.05, 0.10, 0.10])

# Runtime-tunable weights (admin can override via /settings). Kept as a mutable
# array so pipeline scoring picks up the latest values without reload.
ACTIVE_WEIGHTS = SPEC_WEIGHTS.copy()


def set_weights(weights: dict) -> None:
    global ACTIVE_WEIGHTS
    arr = np.array([float(weights.get(k, ACTIVE_WEIGHTS[i])) for i, k in enumerate(SUB_KEYS)], dtype=float)
    total = arr.sum()
    if total > 0:
        arr = arr / total
    ACTIVE_WEIGHTS = arr


class MetaScorer:
    """Wraps a LogisticRegression + isotonic calibrator."""

    def __init__(self, clf: LogisticRegression | None = None, calibrator: IsotonicRegression | None = None):
        self.clf = clf
        self.calibrator = calibrator

    @classmethod
    def seed(cls) -> "MetaScorer":
        """Build a seed model that reproduces the PDF weighted-average.

        We fit LogReg on synthetic pairs so its decision function tracks the
        spec-weighted sum; refits from real feedback replace this.
        """
        rng = np.random.default_rng(42)
        X = rng.integers(0, 101, size=(2000, 8)).astype(float)
        weighted = (X * SPEC_WEIGHTS).sum(axis=1)
        y = (weighted >= 70).astype(int)
        clf = LogisticRegression(max_iter=1000, C=1.0).fit(X, y)
        probs = clf.predict_proba(X)[:, 1]
        cal = IsotonicRegression(out_of_bounds="clip").fit(probs, weighted / 100.0)
        return cls(clf=clf, calibrator=cal)

    def predict_score(self, sub_scores: dict[str, float]) -> int:
        x = np.array([[sub_scores.get(k, 50) for k in SUB_KEYS]], dtype=float)
        # LR + isotonic prediction (learned)
        if self.clf is not None and self.calibrator is not None:
            p = self.clf.predict_proba(x)[0, 1]
            calibrated = float(self.calibrator.predict([p])[0])
            learned = max(0.0, min(1.0, calibrated))
        else:
            learned = float((x * SPEC_WEIGHTS).sum() / 100.0)
        # Weighted anchor lets admins tune weights and see immediate effect
        # without a full retrain — blended 50/50 with the learned score.
        anchor = float((x * ACTIVE_WEIGHTS).sum() / 100.0)
        blended = 0.5 * learned + 0.5 * anchor
        return int(round(max(0.0, min(1.0, blended)) * 100))

    def refit(self, X: np.ndarray, y: np.ndarray) -> None:
        """Warm-start refit from labeled feedback (y=1 accurate/authentic)."""
        if len(np.unique(y)) < 2:
            return  # cannot fit a binary model without both classes
        self.clf = LogisticRegression(max_iter=1000, C=1.0, warm_start=True).fit(X, y)
        probs = self.clf.predict_proba(X)[:, 1]
        # target: weighted spec score as a sanity anchor blended with labels
        anchor = (X * SPEC_WEIGHTS).sum(axis=1) / 100.0
        target = 0.5 * anchor + 0.5 * y.astype(float)
        self.calibrator = IsotonicRegression(out_of_bounds="clip").fit(probs, target)
