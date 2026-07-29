"""Precision / recall / F1 + confusion matrix helpers."""
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score, confusion_matrix

def evaluate(y_true, y_pred) -> dict:
    return {
        "accuracy":  round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1":        round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "confusion": confusion_matrix(y_true, y_pred).tolist(),
        "n": int(len(y_true)),
    }
