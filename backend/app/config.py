"""Central configuration. Every path, secret and threshold comes from the
environment (loaded from backend/.env) - nothing is hardcoded."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/

load_dotenv(BASE_DIR / ".env")


def _path(env_var: str, default: Path) -> Path:
    raw = os.getenv(env_var)
    return Path(raw).expanduser() if raw else default


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-change-me")

    # --- Database -----------------------------------------------------------
    # Swap SQLite for Postgres by setting DATABASE_URL in .env.
    DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'instance' / 'credit_risk.db'}"
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- ML artifacts & dataset ---------------------------------------------
    MODEL_DIR = _path("MODEL_DIR", BASE_DIR / "ml" / "artifacts")
    DATA_PATH = _path("DATA_PATH", BASE_DIR / "data" / "german_credit.csv")

    # --- Logging ------------------------------------------------------------
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

    # --- Risk banding (probability-of-default cutoffs) ----------------------
    RISK_LOW_THRESHOLD = float(os.getenv("RISK_LOW_THRESHOLD", "0.33"))
    RISK_HIGH_THRESHOLD = float(os.getenv("RISK_HIGH_THRESHOLD", "0.66"))

    # --- Pagination ---------------------------------------------------------
    HISTORY_DEFAULT_PER_PAGE = int(os.getenv("HISTORY_DEFAULT_PER_PAGE", "20"))
    HISTORY_PER_PAGE_CAP = int(os.getenv("HISTORY_PER_PAGE_CAP", "100"))

    MAX_CONTENT_LENGTH = 1 * 1024 * 1024  # 1 MiB request bodies
    JSON_SORT_KEYS = False
