"""Application factory. Wires config, extensions, logging, error handlers,
API blueprints, and loads the ML artifact registry exactly once at startup."""

import logging
import time
import uuid
from pathlib import Path

from flask import Flask, g, has_request_context, jsonify, request

from .config import Config
from .extensions import cors, db, migrate
from .utils.errors import register_error_handlers

logger = logging.getLogger(__name__)


class RequestIdLogFilter(logging.Filter):
    """Stamps the per-request id (stored on flask.g by before_request) onto
    every log record emitted while handling that request."""

    def filter(self, record):
        record.request_id = g.get("request_id") if has_request_context() else None
        return True


class JsonLineFormatter(logging.Formatter):
    """Minimal single-line JSON formatter - good enough for demo log ingestion."""

    def format(self, record):
        import json as _json
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if getattr(record, "request_id", None):
            payload["request_id"] = record.request_id
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return _json.dumps(payload, default=str)


def configure_logging(app: Flask):
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLineFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    level = logging.getLevelName(app.config.get("LOG_LEVEL", "INFO"))
    if not isinstance(level, int):  # unknown name -> fall back
        level = logging.INFO
    root.setLevel(level)


def create_app(config_object=None) -> Flask:
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(config_object or Config)

    # SQLite needs its directory to exist before the engine connects.
    uri = str(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
    if uri.startswith("sqlite:///"):
        db_path = Path(uri.replace("sqlite:///", "", 1))
        db_path.parent.mkdir(parents=True, exist_ok=True)

    configure_logging(app)

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app)
    register_error_handlers(app)

    from .api import register_api_blueprints
    register_api_blueprints(app)

    # Ensure all tables exist (including any added after the last migration).
    # This is safe - create_all only creates tables that don't yet exist and
    # never alters existing ones, so it preserves the audit trail.
    with app.app_context():
        db.create_all()
        try:
            db.session.execute(db.text("SELECT role FROM users LIMIT 1"))
        except Exception:
            db.session.rollback()
            try:
                db.session.execute(db.text("ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'loan_officer'"))
                db.session.commit()
                logger.info("Added role column to users table.")
            except Exception as exc:
                logger.error("Failed to add role column: %s", exc)

    # Load ML artifacts once, eagerly, at startup. Risk banding thresholds
    # travel with the registry so services never read Flask config directly.
    from .services.prediction import ModelRegistry
    with app.app_context():
        ModelRegistry.load(
            app.config["MODEL_DIR"],
            risk_low_threshold=app.config["RISK_LOW_THRESHOLD"],
            risk_high_threshold=app.config["RISK_HIGH_THRESHOLD"],
        )

    @app.before_request
    def assign_request_id():
        g.request_id = uuid.uuid4().hex
        g.start_time = time.perf_counter()

    @app.after_request
    def finish_request(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "")
        duration_ms = round((time.perf_counter() - g.get("start_time", 0)) * 1000, 1)
        logger.info(
            "%s %s -> %s (%sms)",
            request.method, request.path, response.status_code, duration_ms,
        )
        return response

    @app.route("/health")
    def health():
        from .services.prediction import ModelRegistry
        ready = ModelRegistry.is_ready()
        body = {
            "status": "ok" if ready else "degraded",
            "model_ready": ready,
            "database": "configured",
        }
        if not ready:
            body["detail"] = ModelRegistry.load_error()
            return jsonify(body), 503
        return jsonify(body), 200

    return app
