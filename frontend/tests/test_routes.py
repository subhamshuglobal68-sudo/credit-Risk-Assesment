"""Smoke tests for the mock frontend.

These use Flask's test client so no server process is needed and nothing is
written to disk. They assert every page renders (200) and every mock API
returns the shape its template/JS expects.
"""

import pytest

from server import app as flask_app

PAGE_ROUTES = [
    "/",
    "/assessment",
    "/dataset",
    "/fairness",
    "/anomaly",
    "/stability",
    "/scenario",
    "/monitoring",
    "/settings",
]


@pytest.fixture()
def client():
    flask_app.config["TESTING"] = True
    flask_app.config["SECRET_KEY"] = "test"
    with flask_app.test_client() as c:
        yield c


class TestPages:
    @pytest.mark.parametrize("route", PAGE_ROUTES)
    def test_page_renders(self, client, route):
        resp = client.get(route)
        assert resp.status_code == 200


class TestMockApis:
    def test_predict(self, client):
        resp = client.post("/api/predict", json={"age": 35})
        assert resp.status_code == 200
        body = resp.get_json()
        assert "risk_score" in body and "probability_of_default" in body

    def test_explain(self, client):
        resp = client.post("/api/explain", json={"age": 35})
        assert resp.status_code == 200
        assert "explanation" in resp.get_json()

    def test_batch_predict(self, client):
        resp = client.post("/api/batch-predict")
        assert resp.status_code == 200
        assert "groups" in resp.get_json()

    def test_scenario(self, client):
        resp = client.post(
            "/api/scenario",
            json={
                "original": {"age": 35, "income": 50000, "loan_amount": 20000},
                "modified": {"age": 35, "income": 90000, "loan_amount": 20000},
            },
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert "before" in body and "after" in body

    def test_fairness_shape(self, client):
        body = client.get("/api/fairness").get_json()
        assert body["available"] is True
        assert "audits" in body
        for attr, audit in body["audits"].items():
            assert "status" in audit
            assert "demographic_parity_difference" in audit
            assert "group_metrics" in audit

    def test_anomalies_shape(self, client):
        body = client.get("/api/anomalies").get_json()
        assert "count" in body
        assert "anomalous_applications" in body
        for a in body["anomalous_applications"]:
            assert {"id", "timestamp", "risk_score", "risk_category", "recommendation"} <= set(a)

    def test_stability_shape(self, client):
        body = client.get("/api/stability").get_json()
        assert body["available"] is True
        assert "overall_status" in body
        assert "features" in body
        for feat in body["features"].values():
            assert "psi" in feat and "status" in feat

    def test_model_metrics(self, client):
        resp = client.get("/api/model-metrics")
        assert resp.status_code == 200
        assert "selected_model" in resp.get_json()


class TestAuthRoutes:
    def test_login_page_renders(self, client):
        resp = client.get("/login")
        assert resp.status_code == 200
        assert b"Welcome back" in resp.data

    def test_register_page_renders(self, client):
        resp = client.get("/register")
        assert resp.status_code == 200
        assert b"Create your account" in resp.data

    def test_protected_route_redirects(self):
        # Setup clean test client with TESTING = False to verify redirects
        from server import app as flask_app
        flask_app.config["TESTING"] = False
        with flask_app.test_client() as c:
            resp = c.get("/")
            assert resp.status_code == 302
            assert "/login" in resp.location
        # Reset TESTING mode
        flask_app.config["TESTING"] = True

    def test_logout_redirects_and_clears_session(self, client):
        with client.session_transaction() as sess:
            sess["user"] = {"email": "test@crea.ai"}
        
        resp = client.get("/logout")
        assert resp.status_code == 302
        assert "/login" in resp.location
        
        with client.session_transaction() as sess:
            assert "user" not in sess
