"""POST /api/predict and POST /api/batch-predict - validate, score, explain,
persist, respond. HTTP concerns only; all logic lives in services."""

import logging

import numpy as np
from flask import Blueprint, g, jsonify, request
from marshmallow import ValidationError

from ..schemas.applicant import ApplicantSchema, BatchPredictSchema
from ..services import audit, explainability
from ..services.prediction import (
    ModelNotAvailableError,
    ModelRegistry,
    predict_application,
    predict_batch,
)
logger = logging.getLogger(__name__)

predict_bp = Blueprint("predict", __name__)

MAX_BATCH = 5000


def _model_unavailable_response():
    try:
        ModelRegistry.get()
    except ModelNotAvailableError as exc:
        return jsonify({"error": str(exc)}), 503
    return None


@predict_bp.post("/predict")
def predict():
    unavailable = _model_unavailable_response()
    if unavailable:
        return unavailable

    payload = ApplicantSchema().load(request.get_json(silent=True) or {})

    result = predict_application(payload)

    request_id = getattr(g, "request_id", None) or ""
    audit.record_prediction(request_id, payload, result)

    logger.info(
        "prediction complete [request_id=%s risk=%s probability=%s]",
        request_id, result["risk"], result["probability"],
    )
    return jsonify({
        "risk": result["risk"],
        "probability": result["probability"],
        "anomaly": result["anomaly"],
        "anomaly_score": result.get("anomaly_score"),
        "explanation": result["explanation"],
        "model_version": result["model_version"],
    }), 200


@predict_bp.post("/batch-predict")
def batch_predict():
    """Score many applicants in one vectorized model pass. Returns per-row
    results (same shape as /api/predict) plus per-row errors for rows that
    failed validation - one bad row never aborts the whole batch."""
    unavailable = _model_unavailable_response()
    if unavailable:
        return unavailable

    body = request.get_json(silent=True) or {}
    if not isinstance(body.get("applicants"), list) or not body["applicants"]:
        return jsonify({"error": "applicants must be a non-empty list"}), 400

    raw_applicants = body["applicants"]
    if len(raw_applicants) > MAX_BATCH:
        return jsonify({"error": f"Batch exceeds maximum of {MAX_BATCH} rows."}), 400

    applicant_schema = ApplicantSchema()
    registry = ModelRegistry.get()

    valid = []
    errors = []
    for idx, raw in enumerate(raw_applicants):
        try:
            valid.append((idx, applicant_schema.load(raw)))
        except ValidationError as exc:
            errors.append({
                "index": idx,
                "row_number": idx + 1,
                "error": "; ".join(
                    f"{f}: {' '.join(m)}" for f, m in exc.messages.items()
                ),
            })

    results = []
    if valid:
        valid_applicants = [row for _, row in valid]
        batch_results = predict_batch(valid_applicants, registry)

        x_matrix = np.vstack([
            core.pop("_x_row") for core in batch_results
        ])
        try:
            explanations = explainability.explain_batch(registry, x_matrix)
        except Exception:  # noqa: BLE001 - explanation must never break batch
            explanations = [{} for _ in batch_results]

        request_id = getattr(g, "request_id", None) or ""
        for (idx, payload), core, explanation in zip(valid, batch_results, explanations):
            core["explanation"] = explanation
            audit.record_prediction(request_id, payload, core)
            results.append({"index": idx, "row_number": idx + 1, "result": core})

    logger.info(
        "batch complete [request_id=%s valid=%s errored=%s]",
        getattr(g, "request_id", ""), len(results), len(errors),
    )
    return jsonify({
        "total": len(raw_applicants),
        "processed": len(results),
        "errors": errors,
        "results": results,
    }), 200
