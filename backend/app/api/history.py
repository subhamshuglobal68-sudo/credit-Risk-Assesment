"""GET /api/history - paginated read from the audit table."""

import logging

from flask import Blueprint, current_app, jsonify, request

from ..schemas.applicant import HistoryQuerySchema
from ..services.audit import paginated_history

logger = logging.getLogger(__name__)

history_bp = Blueprint("history", __name__)


@history_bp.get("/history")
def history():
    query = HistoryQuerySchema().load(request.args)
    # Default page size comes from config, not the schema, so .env stays
    # the single source of truth for pagination behaviour.
    result = paginated_history(
        page=query["page"],
        per_page=query["per_page"] or current_app.config["HISTORY_DEFAULT_PER_PAGE"],
        cap=current_app.config["HISTORY_PER_PAGE_CAP"],
    )
    return jsonify(result), 200
