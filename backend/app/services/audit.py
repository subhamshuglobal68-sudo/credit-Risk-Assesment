"""Audit-trail persistence. Lives in services/ because writing audit rows
is business logic - routes only call these helpers."""

import logging

from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models.audit import AuditRecord

logger = logging.getLogger(__name__)

_APPLICANT_FIELDS = ("age", "job", "credit_amount", "duration", "existing_credits")


def _applicant_columns(applicant: dict) -> dict:
    return {field: applicant.get(field) for field in _APPLICANT_FIELDS}


def record_prediction(request_id: str, applicant: dict, result: dict) -> AuditRecord | None:
    """Persist one /api/predict call. Returns the row, or None if persistence
    failed - audit completeness must not block returning a prediction."""
    try:
        row = AuditRecord(
            request_id=request_id,
            record_type="prediction",
            **_applicant_columns(applicant),
            risk_category=result["risk"],
            probability=result["probability"],
            is_anomalous=bool(result.get("anomaly", False)),
            model_version=result.get("model_version"),
            input_payload=applicant,
            explanation=result.get("explanation"),
        )
        db.session.add(row)
        db.session.commit()
        return row
    except SQLAlchemyError:
        logger.exception(
            "Failed to persist prediction audit row [request_id=%s]", request_id
        )
        db.session.rollback()
        return None


def record_scenario(request_id: str, original: dict, modified: dict, result: dict) -> None:
    """Persist one /api/scenario call as a single row keyed to the modified
    inputs (both risks live inside result). Same swallow-and-log policy."""
    try:
        db.session.add(AuditRecord(
            request_id=request_id,
            record_type="scenario",
            **_applicant_columns(modified),
            risk_category=result["new_risk"],
            probability=result["new_probability"],
            model_version=result.get("model_version"),
            input_payload={"original": original, "modified": modified},
        ))
        db.session.commit()
    except SQLAlchemyError:
        logger.exception(
            "Failed to persist scenario audit row [request_id=%s]", request_id
        )
        db.session.rollback()


def paginated_history(page: int, per_page: int, cap: int) -> dict:
    """Newest-first pagination over the audit table. per_page is hard-capped."""
    pagination = (
        AuditRecord.query
        .order_by(AuditRecord.id.desc())
        .paginate(page=page, per_page=min(per_page, cap), error_out=False)
    )
    return {
        "items": [row.to_dict() for row in pagination.items],
        "page": pagination.page,
        "total_pages": pagination.pages or 1,
        "total_items": pagination.total,
    }
