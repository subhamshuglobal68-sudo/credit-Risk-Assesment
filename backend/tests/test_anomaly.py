"""Anomaly scoring against a stubbed IsolationForest (no real model needed)."""

import numpy as np

from app.services.anomaly import check_anomaly


class StubIsolationForest:
    def __init__(self, raw_pred, decision):
        self._raw_pred = raw_pred
        self._decision = decision

    def predict(self, x_row):
        return np.array([self._raw_pred])

    def decision_function(self, x_row):
        return np.array([self._decision])


X = np.zeros((1, 4))


class TestCheckAnomaly:
    def test_negative_prediction_flags_anomaly(self):
        result = check_anomaly(StubIsolationForest(-1, -0.25), X)
        assert result["is_anomalous"] is True

    def test_positive_prediction_is_normal(self):
        result = check_anomaly(StubIsolationForest(1, 0.25), X)
        assert result["is_anomalous"] is False

    def test_score_rescales_unusualness_to_zero_one(self):
        # unusualness = clip(0.5 - decision, 0, 1)
        assert check_anomaly(StubIsolationForest(1, -0.3), X)["score"] == 0.8
        assert check_anomaly(StubIsolationForest(1, 0.4), X)["score"] == 0.1

    def test_score_clips_at_zero_for_very_normal_rows(self):
        assert check_anomaly(StubIsolationForest(1, 0.7), X)["score"] == 0.0

    def test_result_types_are_json_safe(self):
        result = check_anomaly(StubIsolationForest(-1, 0.0), X)
        assert isinstance(result["is_anomalous"], bool)
        assert isinstance(result["score"], float)
