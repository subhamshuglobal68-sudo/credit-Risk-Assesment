"""POST /api/scenario contract + nested validation."""

from conftest import VALID_APPLICANT


class TestScenarioEndpoint:
    def test_happy_path_shape(self, client):
        modified = dict(VALID_APPLICANT, credit_amount=8000.0, duration=42)
        resp = client.post(
            "/api/scenario",
            json={"original": VALID_APPLICANT, "modified": modified},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        for key in ("original_risk", "new_risk", "original_probability",
                    "new_probability", "probability_delta", "risk_changed",
                    "changed_fields"):
            assert key in body
        assert 0.0 <= body["original_probability"] <= 1.0
        assert 0.0 <= body["new_probability"] <= 1.0
        assert len(body["changed_fields"]) == 2

    def test_missing_modified_side_returns_400(self, client):
        resp = client.post("/api/scenario", json={"original": VALID_APPLICANT})
        assert resp.status_code == 400

    def test_nested_validation_error_names_path(self, client):
        bad = dict(VALID_APPLICANT, existing_credits=99)
        resp = client.post(
            "/api/scenario",
            json={"original": VALID_APPLICANT, "modified": bad},
        )
        assert resp.status_code == 400
        assert "modified" in resp.get_json()["details"]
