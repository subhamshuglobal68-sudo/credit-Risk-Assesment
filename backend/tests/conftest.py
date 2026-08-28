"""Shared pytest fixtures.

Service-layer tests load the real trained artifacts DIRECTLY (no Flask, no
HTTP) to prove the services are testable in isolation. API tests build the
app factory against a throwaway SQLite file so the real instance/ database
is never touched.

Run from backend/:  python -m pytest
"""

from pathlib import Path

import pytest

from app import create_app
from app.config import Config
from app.extensions import db as _db
from app.models.audit import AuditRecord
from app.services.prediction import ModelRegistry

BACKEND_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BACKEND_DIR / "ml" / "artifacts"

VALID_APPLICANT = {
    "age": 35,
    "job": "skilled",
    "credit_amount": 3000.0,
    "duration": 12,
    "existing_credits": 1,
}


# ---------------------------------------------------------------------------
# Service-layer fixture (no Flask involved)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def registry():
    """Real ModelRegistry loaded straight from the .pkl artifacts."""
    ModelRegistry.reset()
    reg = ModelRegistry.load(ARTIFACTS_DIR)
    if reg is None:  # pragma: no cover - environment problem, fail loudly
        pytest.fail(f"Could not load ML artifacts from {ARTIFACTS_DIR}")
    yield reg
    ModelRegistry.reset()


# ---------------------------------------------------------------------------
# API fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def app(tmp_path):
    class TestConfig(Config):
        TESTING = True
        LOG_LEVEL = "WARNING"
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'test_audit.db'}"
        HISTORY_DEFAULT_PER_PAGE = 5
        HISTORY_PER_PAGE_CAP = 10

    ModelRegistry.reset()
    application = create_app(TestConfig)
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()
    ModelRegistry.reset()


@pytest.fixture()
def client(app):
    return app.test_client()


def make_record(i: int, **overrides) -> AuditRecord:
    """Factory for audit rows used by history/audit tests."""
    params = dict(
        request_id=f"req-{i:04d}",
        record_type="prediction",
        age=30 + (i % 40),
        job="skilled",
        credit_amount=1000.0 + i,
        duration=6 + i,
        existing_credits=1 + (i % 3),
        risk_category=["Low", "Medium", "High"][i % 3],
        probability=round(0.01 * (i % 99) + 0.005, 4),
        is_anomalous=bool(i % 7 == 0),
        model_version="testversion01",
        input_payload={"seed": i},
        explanation={"method": "shap", "seed": i},
    )
    params.update(overrides)
    return AuditRecord(**params)


def seed_records(n: int):
    _db.session.add_all(make_record(i) for i in range(n))
    _db.session.commit()
