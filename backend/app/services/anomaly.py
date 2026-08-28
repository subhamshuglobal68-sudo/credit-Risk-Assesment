"""Isolation Forest anomaly scoring.

An "anomalous" application is a monitoring / manual-review signal only -
never an automatic accusation of fraud. Ported from the proven logic in the
previous monolith (src/anomaly_detection.py)."""

import numpy as np


def check_anomaly(anomaly_model, x_row) -> dict:
    """Score one preprocessed feature row.

    Returns {"is_anomalous": bool, "score": float} where score is rescaled
    unusualness in [0, 1] (higher = more unusual).
    """
    raw_pred = anomaly_model.predict(x_row)          # -1 = anomaly, 1 = normal
    decision = anomaly_model.decision_function(x_row)  # roughly -0.5..0.5
    unusualness = np.clip(0.5 - decision, 0, 1)
    return {
        "is_anomalous": bool(raw_pred[0] == -1),
        "score": round(float(unusualness[0]), 4),
    }
