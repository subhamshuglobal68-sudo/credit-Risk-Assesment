"""POST /api/predict contract + validation behaviour."""

from conftest import VALID_APPLICANT


class TestPredictEndpoint:
    def test_happy_path_matches_contract(self, client):
        resp = client.post("/api/predict", json=dict(VALID_APPLICANT))
        assert resp.status_code == 200
        body = resp.get_json()
        for key in ("risk", "probability", "anomaly", "explanation",
                    "model_version"):
            assert key in body
        assert body["risk"] in {"Low", "Medium", "High"}
        assert 0.0 <= body["probability"] <= 1.0

    def test_request_id_header_returned(self, client):
        resp = client.post("/api/predict", json=dict(VALID_APPLICANT))
        assert resp.headers.get("X-Request-ID")

    def test_missing_field_returns_field_level_errors(self, client):
        payload = dict(VALID_APPLICANT)
        payload.pop("age")
        resp = client.post("/api/predict", json=payload)
        assert resp.status_code == 400
        body = resp.get_json()
        assert "error" in body
        assert "age" in body["details"]

    def test_unknown_field_ignored(self, client):
        resp = client.post(
            "/api/predict", json=dict(VALID_APPLICANT, nickname="x")
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["risk"] in {"Low", "Medium", "High"}

    def test_underage_applicant_rejected(self, client):
        resp = client.post("/api/predict", json=dict(VALID_APPLICANT, age=17))
        assert resp.status_code == 400

    def test_unknown_job_category_rejected(self, client):
        resp = client.post(
            "/api/predict", json=dict(VALID_APPLICANT, job="astronaut")
        )
        assert resp.status_code == 400

    def test_non_json_body_is_400_not_500(self, client):
        resp = client.post(
            "/api/predict", data="not-json", content_type="application/json"
        )
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_empty_body_is_400(self, client):
        resp = client.post("/api/predict", json={})
        assert resp.status_code == 400
