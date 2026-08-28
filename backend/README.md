# Credit-Risk Backend

Flask JSON API for an AI credit-risk application. An applicant submits five
fields and receives a Low/Medium/High risk band with probability of default,
an Isolation-Forest anomaly flag, a SHAP-based explanation, and a persisted,
traceable audit record.

```
routes (HTTP only)  ->  services (ML/business logic, zero Flask)  ->  ModelRegistry (.pkl singletons)
        |                                                                      |
   schemas (marshmallow)                                          ml/train.py fits them once
        |
   SQLAlchemy AuditRecord  <-  Flask-Migrate/Alembic
```

**Layering rules** (enforced by tests): routes only parse requests and call
services; services never import Flask; training-time preprocessing and
inference-time preprocessing share one fitted transformer (`preprocessor.pkl`),
so feature drift between train and serve is structurally impossible.

---

## Quickstart

```bash
cd backend
python -m venv venv && venv\Scripts\activate     # Windows
pip install -r requirements.txt

# 1. Train artifacts (skip if ml/artifacts/*.pkl already exist)
python -m ml.train

# 2. Create/migrate the database
set FLASK_APP=run.py          # Windows; use `export` on macOS/Linux
python -m flask db upgrade

# 3. Run the dev server
python run.py                 # http://127.0.0.1:5000
```

Health probe: `GET /health` -> `200 {"status": "ok", "model_ready": true}`.

## Tests

```bash
python -m pytest
```

62 tests: service layer runs directly against the real artifacts (no HTTP),
API tests use the Flask test client against a throwaway SQLite database.
The real `instance/credit_risk.db` is never touched by tests.

## API Contract

Every response carries an `X-Request-ID` header; errors always return
`{"error": "...", "details": {...}}` — malformed input is a field-level 400,
never a raw 500.

### `POST /api/predict`

```bash
curl -X POST http://127.0.0.1:5000/api/predict \
  -H "Content-Type: application/json" \
  -d "{\"age\":35,\"job\":\"skilled\",\"credit_amount\":3000,\"duration\":12,\"existing_credits\":1}"
```

```json
{
  "risk": "Low",
  "probability": 0.0872,
  "anomaly": false,
  "anomaly_score": 0.31,
  "explanation": {
    "method": "shap",
    "is_local_shap": true,
    "risk_increasing_factors": [{"feature": "credit amount", "value": 3000.0, "contribution": 0.21, "explanation": "..."}],
    "risk_reducing_factors": []
  },
  "model_version": "97f0a0cf70fc"
}
```

Field rules: `age` int 18–120 · `duration` int months ≥ 1 ·
`existing_credits` int ≥ 1 · `credit_amount` float ≥ 1 ·
`job` one of `"unemp/unskilled non res"`, `"unskilled resident"`,
`"skilled"`, `"high qualif/self emp/mgmt"` (categories observed at training
time; unknown values rejected rather than silently zeroed).

### `POST /api/scenario`

What-if comparison. Both sides must be complete applicants; scoring calls
the same primitive twice — no duplicated prediction logic.

```json
{
  "original": {"age": 35, "job": "skilled", "credit_amount": 3000, "duration": 12, "existing_credits": 1},
  "modified": {"age": 45, "job": "unskilled resident", "credit_amount": 9000, "duration": 48, "existing_credits": 3}
}
```

Response adds `probability_delta`, `risk_changed`, `changed_fields`
(before/after per differing field) on top of the before/after risks and
probabilities. Scenario audit rows persist `model_version` too.

### `GET /api/history?page=1&per_page=20`

Paginated newest-first audit log. `per_page` is capped (default 100).
Items expose flattened filterable columns (`age`, `job`, `credit_amount`,
`duration`, `existing_credits`, `risk_category`, `probability`,
`is_anomalous`, `model_version`, `request_id`, `record_type`, `created_at`);
variable-shaped payloads (input payload, SHAP output) stay out of list
responses.

## Configuration (backend/.env)

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | dev value | Flask session signing |
| `DATABASE_URL` | SQLite under `instance/` | Swap to Postgres with one line (`postgresql+psycopg://...`) |
| `LOG_LEVEL` | `INFO` | Root logger level; logs are single-line JSON with `request_id` |
| `RISK_LOW_THRESHOLD` | `0.33` | Probability < x => Low band |
| `RISK_HIGH_THRESHOLD` | `0.66` | Probability >= y => High band |
| `HISTORY_DEFAULT_PER_PAGE` | `20` | Page size when `per_page` omitted |
| `HISTORY_PER_PAGE_CAP` | `100` | Hard cap on `per_page` |
| `MODEL_DIR` / `DATA_PATH` | `ml/artifacts` / `data/german_credit.csv` | Artifact & dataset locations |

Copy `.env.example` to `.env`; never commit the real `.env`.

## Traceability

`model_version` is a 12-hex SHA-256 over the sorted artifact bytes, computed
at load time. Every prediction and scenario row stores it alongside inputs
and outcomes, so results stay attributable after any retrain (retraining
always changes the hash).

## Known Limitations

- **SQLite write concurrency.** SQLite allows a single writer; simultaneous
  users may hit brief lock contention on audit inserts. Acceptable for a
  demo; switching to Postgres is a one-line `DATABASE_URL` change (audit
  failures deliberately never block a prediction response either way).
- **Synchronous SHAP on every predict.** Explanations are computed inline by
  design so the API contract always includes them. With the current logistic
  regression + `LinearExplainer` this costs milliseconds (explainer built
  once at startup). If a future retrain selects a heavier tree ensemble,
  consider gating explanations behind `?explain=true`.
- **Five live features, fifteen imputed.** The API accepts the five applicant
  fields; the other fifteen training features are filled by the pipeline's
  train-time imputers (population medians/modes). Predictions therefore blend
  submitted data with typical-population values — fine for a demo, worth
  widening the intake form before anything real.
- **Decision-support only.** Not validated for real lending decisions.
