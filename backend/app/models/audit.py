"""AuditRecord: every prediction (and scenario run) is persisted here for
traceability. Frequently-filtered fields are flattened columns; genuinely
variable-shaped data (raw input payload, SHAP explanation) is JSON."""

from datetime import datetime, timezone

from ..extensions import db


class AuditRecord(db.Model):
    __tablename__ = "audit_records"

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.String(32), nullable=False, index=True)
    record_type = db.Column(db.String(16), nullable=False, default="prediction")

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Flattened applicant fields (filterable / aggregatable).
    age = db.Column(db.Integer)
    job = db.Column(db.String(64))
    credit_amount = db.Column(db.Float)
    duration = db.Column(db.Integer)          # months
    existing_credits = db.Column(db.Integer)

    # Outcome.
    risk_category = db.Column(db.String(8), index=True)
    probability = db.Column(db.Float, index=True)
    is_anomalous = db.Column(db.Boolean, default=False, nullable=False)
    model_version = db.Column(db.String(16))

    # Variable-shaped extras kept as JSON on purpose.
    input_payload = db.Column(db.JSON)
    explanation = db.Column(db.JSON)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "request_id": self.request_id,
            "record_type": self.record_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "age": self.age,
            "job": self.job,
            "credit_amount": self.credit_amount,
            "duration": self.duration,
            "existing_credits": self.existing_credits,
            "risk_category": self.risk_category,
            "probability": self.probability,
            "is_anomalous": self.is_anomalous,
            "model_version": self.model_version,
        }
