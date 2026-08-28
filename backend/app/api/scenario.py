"""POST /api/scenario - what-if comparison.

Reuses services.prediction.run_scenario (which calls the same scoring
primitive twice); no prediction logic is duplicated here."""

import logging

from flask import Blueprint, g, jsonify, request

from ..schemas.applicant import ScenarioSchema
from ..services import audit
from ..services.prediction import ModelNotAvailableError, ModelRegistry, run_scenario

logger = logging.getLogger(__name__)

scenario_bp = Blueprint("scenario", __name__)


def _model_unavailable_response():
    try:
        ModelRegistry.get()
    except ModelNotAvailableError as exc:
        return jsonify({"error": str(exc)}), 503
    return None


@scenario_bp.post("/scenario")
def scenario():
    unavailable = _model_unavailable_response()
    if unavailable:
        return unavailable

    payload = ScenarioSchema().load(request.get_json(silent=True) or {})
    original, modified = payload["original"], payload["modified"]

    result = run_scenario(original, modified)

    request_id = getattr(g, "request_id", None) or ""
    audit.record_scenario(request_id, original, modified, result)

    logger.info(
        "scenario complete [request_id=%s %s -> %s]",
        request_id, result["original_risk"], result["new_risk"],
    )
    return jsonify({
        "original_risk": result["original_risk"],
        "new_risk": result["new_risk"],
        "original_probability": result["original_probability"],
        "new_probability": result["new_probability"],
        "probability_delta": result["probability_delta"],
        "risk_changed": result["risk_changed"],
        "changed_fields": result["changed_fields"],
        "original_anomaly": result["original_anomaly"],
        "new_anomaly": result["new_anomaly"],
        "original_anomaly_score": result["original_anomaly_score"],
        "new_anomaly_score": result["new_anomaly_score"],
        "original_explanation": result["original_explanation"],
        "new_explanation": result["new_explanation"],
        "model_version": result["model_version"],
    }), 200
