"""Review queue service.

Builds and manages the manual review queue from prediction audit records.
Transparent priority scoring, human-readable reasons, and timeline assembly."""

import logging
from datetime import datetime, timezone

from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models.audit import AuditRecord
from ..models.review import ReviewRecord

logger = logging.getLogger(__name__)

VALID_STATUSES = {"OPEN", "IN_REVIEW", "VERIFICATION_REQUIRED", "ESCALATED", "RESOLVED"}
VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}


def compute_priority(risk_category: str, is_anomalous: bool, probability: float) -> str:
    """Transparent priority rules:
    - HIGH risk + anomaly -> HIGH
    - HIGH risk (no anomaly) -> HIGH
    - MEDIUM risk + anomaly -> HIGH
    - MEDIUM risk (no anomaly) -> MEDIUM
    - LOW risk + anomaly -> MEDIUM
    - LOW risk (no anomaly) -> LOW
    """
    if risk_category == "High":
        return "HIGH"
    if risk_category == "Medium" and is_anomalous:
        return "HIGH"
    if risk_category == "Medium":
        return "MEDIUM"
    if is_anomalous:
        return "MEDIUM"
    return "LOW"


def get_review_reasons(applicant: dict, risk_category: str, is_anomalous: bool) -> list:
    """Generate human-readable reasons why this application was flagged."""
    reasons = []

    if risk_category == "High":
        reasons.append("High risk classification (probability of default > 66%)")
    elif risk_category == "Medium":
        reasons.append("Medium risk - borderline decision requires review")

    if is_anomalous:
        reasons.append("Anomalous profile detected - differs significantly from training population")

    age = applicant.get("age")
    if age and age < 25:
        reasons.append("Young applicant (< 25 years) - limited credit history")
    elif age and age > 65:
        reasons.append("Senior applicant (> 65 years) - retirement income considerations")

    credit_amount = applicant.get("credit_amount")
    duration = applicant.get("duration")
    if credit_amount and duration:
        monthly_payment = credit_amount / max(duration, 1)
        if monthly_payment > 1000:
            reasons.append(f"High monthly obligation (~{monthly_payment:.0f}/month)")

    existing_credits = applicant.get("existing_credits")
    if existing_credits and existing_credits >= 3:
        reasons.append(f"Multiple existing credits ({existing_credits}) - high debt exposure")

    job = applicant.get("job")
    if job and "unskilled" in str(job).lower():
        reasons.append("Unskilled employment - income stability concern")

    if not reasons:
        reasons.append("Flagged for review by automated screening")

    return reasons


def create_review_from_audit(audit_row: AuditRecord) -> ReviewRecord | None:
    """Create a ReviewRecord from an existing AuditRecord. Idempotent -
    returns existing record if one already exists for this audit row."""
    existing = ReviewRecord.query.filter_by(audit_record_id=audit_row.id).first()
    if existing:
        return existing

    applicant = audit_row.input_payload or {}
    risk_category = audit_row.risk_category or "Medium"
    is_anomalous = audit_row.is_anomalous
    probability = audit_row.probability or 0.5

    priority = compute_priority(risk_category, is_anomalous, probability)
    reasons = get_review_reasons(applicant, risk_category, is_anomalous)

    try:
        row = ReviewRecord(
            audit_record_id=audit_row.id,
            request_id=audit_row.request_id,
            age=audit_row.age,
            job=audit_row.job,
            credit_amount=audit_row.credit_amount,
            duration=audit_row.duration,
            existing_credits=audit_row.existing_credits,
            risk_category=risk_category,
            probability=probability,
            is_anomalous=is_anomalous,
            anomaly_score=0,
            review_priority=priority,
            review_reasons=reasons,
            status="OPEN",
            input_payload=applicant,
        )
        db.session.add(row)
        db.session.commit()
        return row
    except SQLAlchemyError:
        logger.exception("Failed to create review record [audit_id=%s]", audit_row.id)
        db.session.rollback()
        return None


def auto_create_reviews() -> int:
    """Scan audit records and create review records for any that need one.
    Returns the number of new reviews created."""
    # Find audit records that should have reviews (prediction type, not scenario).
    flagged = (
        AuditRecord.query
        .filter_by(record_type="prediction")
        .filter(
            db.or_(
                AuditRecord.risk_category == "High",
                AuditRecord.risk_category == "Medium",
                AuditRecord.is_anomalous == True,
            )
        )
        .all()
    )

    count = 0
    for audit_row in flagged:
        review = create_review_from_audit(audit_row)
        if review and review.id:  # newly created (has id from DB)
            count += 1
    return count


def get_review_queue(
    risk_category: str | None = None,
    is_anomalous: bool | None = None,
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Paginated review queue with optional filters."""
    query = ReviewRecord.query

    if risk_category:
        query = query.filter(ReviewRecord.risk_category == risk_category)
    if is_anomalous is not None:
        query = query.filter(ReviewRecord.is_anomalous == is_anomalous)
    if status:
        query = query.filter(ReviewRecord.status == status)
    if priority:
        query = query.filter(ReviewRecord.review_priority == priority)
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                ReviewRecord.request_id.ilike(like),
                ReviewRecord.job.ilike(like),
            )
        )

    # Priority order: HIGH first, then MEDIUM, then LOW; newest first within each.
    from sqlalchemy import case
    priority_order = case(
        (ReviewRecord.review_priority == "HIGH", 0),
        (ReviewRecord.review_priority == "MEDIUM", 1),
        else_=2,
    )
    query = query.order_by(priority_order, ReviewRecord.created_at.desc())

    pagination = query.paginate(page=page, per_page=min(per_page, 100), error_out=False)
    return {
        "items": [r.to_dict() for r in pagination.items],
        "page": pagination.page,
        "total_pages": pagination.pages or 1,
        "total_items": pagination.total,
    }


def get_review_detail(review_id: int) -> ReviewRecord | None:
    """Get a single review record by ID."""
    return ReviewRecord.query.get(review_id)


def update_review_status(review_id: int, new_status: str) -> ReviewRecord | None:
    """Update a review record's status."""
    if new_status not in VALID_STATUSES:
        return None
    row = ReviewRecord.query.get(review_id)
    if not row:
        return None
    row.status = new_status
    row.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return row


def add_review_note(review_id: int, text: str, author: str = "reviewer") -> ReviewRecord | None:
    """Append a note to a review record."""
    row = ReviewRecord.query.get(review_id)
    if not row:
        return None
    notes = list(row.reviewer_notes or [])
    notes.append({
        "text": text,
        "author": author,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    row.reviewer_notes = notes
    row.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return row


def get_review_stats() -> dict:
    """Aggregate counts for the dashboard widget."""
    total = ReviewRecord.query.count()
    open_count = ReviewRecord.query.filter_by(status="OPEN").count()
    in_review = ReviewRecord.query.filter_by(status="IN_REVIEW").count()
    verification = ReviewRecord.query.filter_by(status="VERIFICATION_REQUIRED").count()
    escalated = ReviewRecord.query.filter_by(status="ESCALATED").count()
    resolved = ReviewRecord.query.filter_by(status="RESOLVED").count()
    high_priority = ReviewRecord.query.filter_by(review_priority="HIGH", status="OPEN").count()
    anomalous = ReviewRecord.query.filter_by(is_anomalous=True).filter(
        ReviewRecord.status.in_(["OPEN", "IN_REVIEW"])
    ).count()

    return {
        "total": total,
        "open": open_count,
        "in_review": in_review,
        "verification_required": verification,
        "escalated": escalated,
        "resolved": resolved,
        "high_priority": high_priority,
        "anomalous_pending": anomalous,
    }


def get_timeline(review_id: int) -> list:
    """Build a timeline from audit trail for a specific application."""
    row = ReviewRecord.query.get(review_id)
    if not row:
        return []

    events = []

    # Creation event.
    events.append({
        "type": "created",
        "timestamp": row.created_at.isoformat() if row.created_at else None,
        "detail": f"Review created - {row.review_priority} priority",
        "reasons": row.review_reasons or [],
    })

    # Reviewer notes as timeline events.
    for note in (row.reviewer_notes or []):
        events.append({
            "type": "note",
            "timestamp": note.get("timestamp"),
            "detail": note.get("text", ""),
            "author": note.get("author", "unknown"),
        })

    # Status changes (inferred from updated_at if different from created_at).
    if row.updated_at and row.created_at and row.updated_at != row.created_at:
        events.append({
            "type": "status_update",
            "timestamp": row.updated_at.isoformat(),
            "detail": f"Status updated to {row.status}",
        })

    events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
    return events
