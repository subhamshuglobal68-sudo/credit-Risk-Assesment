"""Prediction orchestration against the REAL trained artifacts.

These tests call the service functions directly - no Flask, no HTTP -
which is the deliverable's core testability requirement.
"""

import re

import pytest

from app.services.prediction import (
    ModelNotAvailableError,
    ModelRegistry,
    predict_application,
    predict_core,
    run_scenario,
)
from conftest import ARTIFACTS_DIR, VALID_APPLICANT

VERSION_RE = re.compile(r"^[0-9a-f]{12}$")


class TestRegistry:
    def test_version_format(self, registry):
        assert VERSION_RE.match(registry.version)

    def test_version_is_stable_across_loads(self):
        first = ModelRegistry.load(ARTIFACTS_DIR)
        version = first.version
        ModelRegistry.reset()
        second = ModelRegistry.load(ARTIFACTS_DIR)
        assert second.version == version

    def test_thresholds_are_injectable_without_flask(self):
        reg = ModelRegistry(
            ARTIFACTS_DIR, risk_low_threshold=0.01, risk_high_threshold=0.02
        )
        assert reg.risk_low_threshold == 0.01
        assert reg.risk_high_threshold == 0.02

    def test_get_raises_when_not_loaded(self, registry):
        ModelRegistry.reset()
        try:
            with pytest.raises(ModelNotAvailableError):
                ModelRegistry.get()
        finally:
            # restore for later run_scenario tests that use get() internally
            ModelRegistry.load(ARTIFACTS_DIR)


class TestPredictCore:
    def test_shape_and_bounds(self, registry):
        result = predict_core(dict(VALID_APPLICANT), registry)
        assert result["risk"] in {"Low", "Medium", "High"}
        assert 0.0 <= result["probability"] <= 1.0
        assert isinstance(result["anomaly"], bool)
        assert isinstance(result["anomaly_score"], float)
        assert result["model_version"] == registry.version

    def test_deterministic_for_same_input(self, registry):
        a = predict_core(dict(VALID_APPLICANT), registry)
        b = predict_core(dict(VALID_APPLICANT), registry)
        assert (a["probability"], a["risk"], a["anomaly"]) == \
               (b["probability"], b["risk"], b["anomaly"])

    def test_injected_thresholds_drive_band(self):
        """Config thresholds must actually reach categorize_risk."""
        custom = ModelRegistry(
            ARTIFACTS_DIR, risk_low_threshold=0.99, risk_high_threshold=0.995
        )
        result = predict_core(dict(VALID_APPLICANT), custom)
        assert result["risk"] == "Low"  # any probability < 0.99 lands Low


class TestPredictApplication:
    def test_includes_contract_fields(self, registry):
        result = predict_application(dict(VALID_APPLICANT), registry)
        for key in ("risk", "probability", "anomaly", "explanation",
                    "model_version"):
            assert key in result

    def test_internal_x_row_never_leaks(self, registry):
        result = predict_application(dict(VALID_APPLICANT), registry)
        assert "_x_row" not in result

    def test_explanation_structure(self, registry):
        explanation = predict_application(
            dict(VALID_APPLICANT), registry
        )["explanation"]
        assert explanation["method"] in {"shap", "fallback_feature_importance"}
        assert explanation["is_local_shap"] == (explanation["method"] == "shap")
        factors = (
            explanation["risk_increasing_factors"]
            + explanation["risk_reducing_factors"]
        )
        assert factors
        for factor in factors:
            assert set(factor) >= {"feature", "value", "contribution",
                                   "explanation"}


class TestRunScenario:
    def test_changed_fields_reports_differences(self, registry):
        modified = dict(VALID_APPLICANT, credit_amount=9000.0, duration=36)
        result = run_scenario(VALID_APPLICANT, modified)
        changed = {c["field"]: c for c in result["changed_fields"]}
        assert set(changed) == {"credit_amount", "duration"}
        assert changed["duration"]["before"] == VALID_APPLICANT["duration"]
        assert changed["duration"]["after"] == 36

    def test_identical_inputs_yield_no_change(self, registry):
        result = run_scenario(VALID_APPLICANT, dict(VALID_APPLICANT))
        assert result["changed_fields"] == []
        assert result["risk_changed"] is False
        assert result["probability_delta"] == 0.0

    def test_probability_delta_math(self, registry):
        modified = dict(VALID_APPLICANT, duration=48)
        result = run_scenario(VALID_APPLICANT, modified)
        assert result["probability_delta"] == round(
            result["new_probability"] - result["original_probability"], 4
        )

    def test_model_version_always_present(self, registry):
        """Regression guard: scenario audit rows must stay traceable."""
        result = run_scenario(
            VALID_APPLICANT, dict(VALID_APPLICANT, duration=24)
        )
        assert result["model_version"] == registry.version
