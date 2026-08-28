"""Explanation formatting + fallback path, using stub registries/models."""

import numpy as np

from app.services import explainability


class _FakeModel:
    def __init__(self, coef=None, importances=None):
        if coef is not None:
            self.coef_ = np.asarray(coef)
        if importances is not None:
            self.feature_importances_ = np.asarray(importances)


class RegistryStub:
    """Duck-typed stand-in for ModelRegistry (services must not need Flask)."""

    def __init__(self, explainer_kind=None, explainer=None,
                 coef=None, importances=None, n_features=4):
        self._kind, self._explainer = explainer_kind, explainer
        self.feature_names_out = [f"num__f{i}" for i in range(n_features)]
        self.model = _FakeModel(coef=coef, importances=importances)

    def get_explainer(self):
        return self._kind, self._explainer


class TestFormatting:
    def test_orders_and_splits_contributions(self):
        contributions = [
            ("num__a", 0.5, 1.0),
            ("num__b", -0.9, 2.0),
            ("num__c", 0.2, 3.0),
            ("num__d", -0.1, 4.0),
        ]
        body = explainability._format_contributions(contributions, method="shap")
        increasing = body["risk_increasing_factors"]
        decreasing = body["risk_reducing_factors"]
        assert [f["feature"] for f in increasing] == ["a", "c"]
        assert [f["feature"] for f in decreasing] == ["b", "d"]

    def test_top_n_caps_each_side(self):
        contribs = [
            (f"num__f{i}", 0.1 * (i + 1), 1.0)
            for i in range(explainability.TOP_N + 3)
        ]
        body = explainability._format_contributions(contribs, method="shap")
        assert len(body["risk_increasing_factors"]) == explainability.TOP_N

    def test_zero_contribution_excluded_from_both_sides(self):
        body = explainability._format_contributions(
            [("num__a", 0.0, 1.0)], method="shap"
        )
        assert body["risk_increasing_factors"] == []
        assert body["risk_reducing_factors"] == []

    def test_fallback_body_carries_note_and_flag(self):
        body = explainability._format_contributions(
            [("num__a", 0.5, 1.0)], method="fallback_feature_importance"
        )
        assert body["is_local_shap"] is False
        assert "note" in body

    def test_shap_body_has_no_note(self):
        body = explainability._format_contributions(
            [("num__a", 0.5, 1.0)], method="shap"
        )
        assert body["is_local_shap"] is True
        assert "note" not in body

    def test_human_labels_strip_pipeline_prefixes(self):
        body = explainability._format_contributions(
            [("cat__job_skilled", 0.4, 1.0), ("num__age", -0.4, 30.0)],
            method="shap",
        )
        features = {
            f["feature"]
            for f in body["risk_increasing_factors"] + body["risk_reducing_factors"]
        }
        assert features == {"job skilled", "age"}


class TestFallbackPath:
    def test_uses_feature_importances_when_present(self):
        reg = RegistryStub(importances=[0.9, 0.1, 0.0, 0.0])
        out = explainability.explain(reg, np.array([[1.0, -2.0, 0.0, 5.0]]))
        assert out["method"] == "fallback_feature_importance"
        assert out["risk_increasing_factors"][0]["feature"] == "f0"

    def test_uses_abs_coef_when_no_importances(self):
        reg = RegistryStub(coef=[[2.0, -1.0, 0.0, 0.0]])
        # contribution = |coef| * value, so a NEGATIVE feature value yields
        # a risk-reducing factor even though the coefficient is negative
        out = explainability.explain(reg, np.array([[1.0, -1.0, 0.0, 0.0]]))
        assert out["method"] == "fallback_feature_importance"
        assert out["risk_increasing_factors"][0]["feature"] == "f0"
        assert out["risk_reducing_factors"][0]["feature"] == "f1"

    def test_uniform_importances_when_model_has_neither(self):
        reg = RegistryStub()
        out = explainability.explain(reg, np.array([[1.0, 1.0, -1.0, 0.0]]))
        # ones * values -> two positive contributions survive
        assert len(out["risk_increasing_factors"]) == 2

    def test_explain_never_raises_without_explainer(self):
        reg = RegistryStub()  # explainer is None -> labeled fallback
        out = explainability.explain(reg, np.ones((1, 4)))
        assert out["is_local_shap"] is False
        assert "note" in out
