"""Review Center API endpoints."""

import logging

from flask import Blueprint, jsonify, request

from ..services import review as review_service

logger = logging.getLogger(__name__)

review_bp = Blueprint("review", __name__)


@review_bp.get("/reviews")
def list_reviews():
    """Paginated review queue with filters."""
    risk_category = request.args.get("risk_category")
    is_anomalous = request.args.get("anomalous")
    status = request.args.get("status")
    priority = request.args.get("priority")
    search = request.args.get("search")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    anomalous_bool = None
    if is_anomalous is not None:
        anomalous_bool = is_anomalous.lower() in ("true", "1", "yes")

    result = review_service.get_review_queue(
        risk_category=risk_category,
        is_anomalous=anomalous_bool,
        status=status,
        priority=priority,
        search=search,
        page=page,
        per_page=per_page,
    )
    return jsonify(result)


@review_bp.get("/reviews/stats")
def review_stats():
    """Aggregate counts for dashboard widget."""
    return jsonify(review_service.get_review_stats())


@review_bp.get("/reviews/<int:review_id>")
def review_detail(review_id: int):
    """Single review record with full payload."""
    row = review_service.get_review_detail(review_id)
    if not row:
        return jsonify({"error": "Review not found"}), 404
    return jsonify(row.to_dict())


@review_bp.get("/reviews/<int:review_id>/timeline")
def review_timeline(review_id: int):
    """Timeline of events for a review."""
    events = review_service.get_timeline(review_id)
    return jsonify({"events": events})


@review_bp.patch("/reviews/<int:review_id>/status")
def update_status(review_id: int):
    """Update review status."""
    payload = request.get_json(silent=True) or {}
    new_status = payload.get("status", "")
    if not new_status:
        return jsonify({"error": "status is required"}), 400

    row = review_service.update_review_status(review_id, new_status)
    if not row:
        return jsonify({"error": "Invalid status or review not found"}), 400
    return jsonify(row.to_dict())


@review_bp.post("/reviews/<int:review_id>/notes")
def add_note(review_id: int):
    """Add a reviewer note."""
    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400

    row = review_service.add_review_note(review_id, text)
    if not row:
        return jsonify({"error": "Review not found"}), 404
    return jsonify(row.to_dict())


@review_bp.post("/reviews/seed")
def seed_reviews():
    """Scan audit records and create review records for flagged applications."""
    count = review_service.auto_create_reviews()
    return jsonify({"created": count})
