"""ReviewRecord: tracks applications queued for manual human review.

A review record is auto-created when a prediction has:
  - HIGH risk category
  - Anomaly detected
  - Data quality concern

Reviewers can update status, add notes, and mark resolutions."""

from datetime import datetime, timezone

from ..extensions import db


class ReviewRecord(db.Model):
    __tablename__ = "review_records"

    id = db.Column(db.Integer, primary_key=True)
    audit_record_id = db.Column(db.Integer, db.ForeignKey("audit_records.id"), nullable=True)
    request_id = db.Column(db.String(32), nullable=False, index=True)

    # Applicant snapshot for display without joining audit.
    age = db.Column(db.Integer)
    job = db.Column(db.String(64))
    credit_amount = db.Column(db.Float)
    duration = db.Column(db.Integer)
    existing_credits = db.Column(db.Integer)

    # Prediction outcome that triggered the review.
    risk_category = db.Column(db.String(8), nullable=False, index=True)
    probability = db.Column(db.Float, nullable=False)
    is_anomalous = db.Column(db.Boolean, default=False, nullable=False)
    anomaly_score = db.Column(db.Float, default=0)

    # Priority: HIGH / MEDIUM / LOW (computed at creation time).
    review_priority = db.Column(db.String(8), nullable=False, index=True)

    # Why this was flagged (JSON array of human-readable strings).
    review_reasons = db.Column(db.JSON, default=list)

    # Workflow status.
    status = db.Column(db.String(20), nullable=False, default="OPEN", index=True)

    # Reviewer notes (JSON array of {text, timestamp, author} dicts).
    reviewer_notes = db.Column(db.JSON, default=list)

    # Timestamps.
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Full input payload for investigation view.
    input_payload = db.Column(db.JSON)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "audit_record_id": self.audit_record_id,
            "request_id": self.request_id,
            "age": self.age,
            "job": self.job,
            "credit_amount": self.credit_amount,
            "duration": self.duration,
            "existing_credits": self.existing_credits,
            "risk_category": self.risk_category,
            "probability": self.probability,
            "is_anomalous": self.is_anomalous,
            "anomaly_score": self.anomaly_score,
            "review_priority": self.review_priority,
            "review_reasons": self.review_reasons or [],
            "status": self.status,
            "reviewer_notes": self.reviewer_notes or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "input_payload": self.input_payload,
        }
