# Credit-Risk ML Scoring System

A two-component Flask application for credit risk assessment.

## Architecture

| Component | Port | Purpose | Key Files |
|-----------|------|---------|-----------|
| **Backend** | 5000 | ML API (Logistic Regression + Isolation Forest + SHAP) | `backend/run.py`, `backend/app/` |
| **Frontend** | 5001 | UI proxy that maps user fields → German Credit schema | `frontend/server.py`, `frontend/field_mapper.py` |

## Quick Start

### Backend (port 5000)
```powershell
cd backend
.\venv\Scripts\activate
flask run
# or: python run.py
```

### Frontend (port 5001)
```powershell
cd frontend
.\venv\Scripts\activate
python server.py
```

The frontend proxies all prediction requests to the backend at `http://127.0.0.1:5000` via `field_mapper.py`.

## Testing

```powershell
cd backend
pytest              # all 62 tests pass
pytest tests/fixtures/   # regression payloads available here
```

## Generated / Ignored Files

The following are created at runtime and are **git-ignored**:
- `__pycache__/`, `.pytest_cache/` — Python bytecode & test cache
- `venv/` — virtual environments
- `backend/instance/credit_risk.db` — SQLite audit log (regenerable via `flask db upgrade`)
- `ml/artifacts/*.pkl` — trained model artifacts
- `*.log`, `*.err`, `*.out` — runtime logs

## Field Mapping

The frontend accepts a simplified 10-field schema. `frontend/field_mapper.py` translates these to the 20-field German Credit Data format expected by the backend model.