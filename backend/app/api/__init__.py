"""API blueprint registration."""

from flask import Blueprint

from .history import history_bp
from .predict import predict_bp
from .review import review_bp
from .scenario import scenario_bp
from .auth import auth_bp


def register_api_blueprints(app):
    api = Blueprint("api", __name__, url_prefix="/api")
    api.register_blueprint(predict_bp)
    api.register_blueprint(scenario_bp)
    api.register_blueprint(history_bp)
    api.register_blueprint(review_bp)
    api.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(api)
