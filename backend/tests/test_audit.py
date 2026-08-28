"""Audit-trail integration: API calls must persist traceable DB rows."""

from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models.audit import AuditRecord
from conftest import VALID_APPLICANT


class TestPredictionAuditTrail:
    def test_predict_persists_traceable_row(self, app, client):
        resp = client.post("/api/predict", json=dict(VALID_APPLICANT))
        body = resp.get_json()
        request_id = resp.headers["X-Request-ID"]

        with app.app_context():
            row = AuditRecord.query.filter_by(request_id=request_id).one()

        assert row.record_type == "prediction"
        assert row.age == VALID_APPLICANT["age"]
        assert row.job == VALID_APPLICANT["job"]
        assert row.credit_amount == VALID_APPLICANT["credit_amount"]
        assert row.duration == VALID_APPLICANT["duration"]
        assert row.existing_credits == VALID_APPLICANT["existing_credits"]
        assert row.risk_category == body["risk"]
        assert row.probability == body["probability"]
        assert row.is_anomalous == body["anomaly"]
        # traceability: audit row and response must cite the same artifacts
        assert row.model_version == body["model_version"]
        assert row.input_payload == VALID_APPLICANT
        assert row.explanation["method"] == body["explanation"]["method"]

    def test_scenario_row_records_model_version(self, app, client):
        """Regression: scenario rows used to persist NULL model_version."""
        modified = dict(VALID_APPLICANT, duration=48)
        resp = client.post(
            "/api/scenario",
            json={"original": VALID_APPLICANT, "modified": modified},
        )
        assert resp.status_code == 200
        with app.app_context():
            row = AuditRecord.query.filter_by(record_type="scenario").one()
        assert row.model_version
        assert row.input_payload["original"] == VALID_APPLICANT
        assert row.input_payload["modified"] == modified

    def test_audit_failure_does_not_block_prediction(self, app, client,
                                                     monkeypatch):
        """Audit completeness must never stop a prediction being served."""
        from app.services import audit as audit_service

        def broken_commit():
            raise SQLAlchemyError("simulated outage")

        monkeypatch.setattr(audit_service.db.session, "commit", broken_commit)
        try:
            resp = client.post("/api/predict", json=dict(VALID_APPLICANT))
            assert resp.status_code == 200
        finally:
            monkeypatch.undo()

        with app.app_context():
            assert AuditRecord.query.count() == 0
