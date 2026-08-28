"""Centralized error handling: every failure surfaces as a consistent JSON
body {"error": ..., "details": ...} - never a raw HTML traceback."""

import logging

from flask import g, has_request_context, jsonify, request
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


def _request_id():
    return g.get("request_id") if has_request_context() else None


class ApiError(Exception):
    """Service-layer error carrying an HTTP status and optional details."""

    def __init__(self, message: str, status: int = 400, details=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details


def error_body(message, details=None):
    body = {"error": message}
    if details:
        body["details"] = details
    return body


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(exc):
        return jsonify(error_body(exc.message, exc.details)), exc.status

    @app.errorhandler(ValidationError)
    def handle_validation_error(exc):
        return (
            jsonify(error_body("Request validation failed.", details=exc.messages)),
            400,
        )

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc):
        # Keep 4xx descriptions (useful), hide 5xx internals behind a generic message.
        message = exc.description if exc.code < 500 else "Internal server error."
        if exc.code >= 500:
            # logger.error (not .exception): we are not inside an active
            # except block here, so .exception would log "NoneType: None".
            logger.error(
                "HTTP %s on %s %s [request_id=%s]",
                exc.code, request.method, request.path,
                _request_id(),
            )
        return jsonify(error_body(message)), exc.code

    @app.errorhandler(Exception)
    def handle_unexpected(exc):
        logger.exception(
            "Unhandled exception on %s %s [request_id=%s]",
            request.method,
            request.path,
            _request_id(),
        )
        if app.config.get("TESTING"):
            raise exc
        return jsonify(error_body("Internal server error.")), 500
