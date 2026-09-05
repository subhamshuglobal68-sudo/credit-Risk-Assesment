"""ML artifact loading and prediction orchestration. Zero Flask imports -
everything here is directly unit-testable without an HTTP server.

The ModelRegistry is a process-wide singleton: all .pkl artifacts are read
from disk exactly once (at app startup), including the SHAP explainer, so
no request ever pays model-load or explainer-build cost.

`model_version` is a short SHA-256 over the artifact bytes so predictions
stay traceable across retrains.
"""

import hashlib
import json
import logging
import threading
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from . import anomaly as anomaly_service
from . import explainability
from .risk import categorize_risk

logger = logging.getLogger(__name__)

_load_lock = threading.Lock()

_ARTIFACTS = ("credit_model.pkl", "preprocessor.pkl", "isolation_forest.pkl")
_META_FILE = "metadata.json"


class ModelNotAvailableError(RuntimeError):
    """Raised when required .pkl artifacts are missing or unloadable."""


class ModelRegistry:
    _instance = None
    _load_error = None

    def __init__(self, model_dir: Path,
                 risk_low_threshold: float = 0.33,
                 risk_high_threshold: float = 0.66):
        self.model_dir = Path(model_dir)
        # Injected at startup from app config so banding stays configurable
        # via .env without this module ever importing Flask.
        self.risk_low_threshold = float(risk_low_threshold)
        self.risk_high_threshold = float(risk_high_threshold)
        missing = [f for f in (*_ARTIFACTS, _META_FILE)
                   if not (self.model_dir / f).exists()]
        if missing:
            raise ModelNotAvailableError(
                "ML artifacts not found in "
                f"{self.model_dir}. Missing: {missing}. "
                "Run 'python -m ml.train' first."
            )
        self.model = joblib.load(self.model_dir / "credit_model.pkl")
        self.preprocessor = joblib.load(self.model_dir / "preprocessor.pkl")
        self.anomaly_model = joblib.load(self.model_dir / "isolation_forest.pkl")

        with open(self.model_dir / _META_FILE, encoding="utf-8") as fh:
            self.metadata = json.load(fh)

        self.feature_columns = self.metadata["feature_columns"]
        self.numeric_columns = self.metadata["numeric_columns"]
        self.categorical_columns = self.metadata["categorical_columns"]
        self.feature_names_out = self._output_feature_names()
        self.version = self._compute_version()

        # Background sample (processed) lets LinearExplainer attribute linear
        # models; tree explainers ignore it. Optional - missing data file
        # degrades gracefully to the labeled fallback explainer path.
        self._explainer_kind, self._explainer = None, None
        background = self._build_background()
        self._explainer_kind, self._explainer = explainability.build_explainer(
            self.model, x_background=background
        )

    def _build_background(self):
        """Preprocess up to 100 training rows as the SHAP background.

        Prefer a dataset shipped next to the artifacts (portable across
        machines) and only fall back to the absolute path recorded in
        metadata.json at training time.
        """
        sibling = self.model_dir.parent.parent / "data" / "german_credit.csv"
        data_path = sibling if sibling.exists() else self.metadata.get("dataset_path")
        try:
            sample = pd.read_csv(data_path).head(100)
            frame = sample.reindex(columns=self.feature_columns)
            return preprocess(self, frame)
        except Exception as exc:  # noqa: BLE001 - background is best-effort
            logger.info("No SHAP background sample built (%s).", exc)
            return None

    # -- lifecycle ----------------------------------------------------------
    @classmethod
    def load(cls, model_dir, risk_low_threshold: float = 0.33,
             risk_high_threshold: float = 0.66) -> "ModelRegistry":
        """Load artifacts once; remember failures so /health can report them."""
        with _load_lock:
            try:
                cls._instance = cls(
                    model_dir,
                    risk_low_threshold=risk_low_threshold,
                    risk_high_threshold=risk_high_threshold,
                )
                cls._load_error = None
                logger.info(
                    "Model registry loaded from %s (version=%s, model=%s)",
                    model_dir, cls._instance.version,
                    cls._instance.metadata.get("selected_model"),
                )
            except ModelNotAvailableError as exc:
                cls._instance = None
                cls._load_error = str(exc)
                logger.warning("Model registry unavailable: %s", exc)
            except Exception as exc:  # noqa: BLE001 - corrupt artifacts etc.
                cls._instance = None
                cls._load_error = f"Failed to load ML artifacts: {exc}"
                logger.exception("Model registry load failed.")
            return cls._instance

    @classmethod
    def get(cls) -> "ModelRegistry":
        if cls._instance is None:
            raise ModelNotAvailableError(
                cls._load_error or "Model registry not loaded."
            )
        return cls._instance

    @classmethod
    def load_error(cls) -> str | None:
        """Public accessor for /health - why the registry is unavailable."""
        return cls._load_error

    @classmethod
    def reset(cls):
        """Test hook."""
        cls._instance = None
        cls._load_error = None

    @classmethod
    def is_ready(cls) -> bool:
        return cls._instance is not None

    # -- internals ----------------------------------------------------------
    def _output_feature_names(self):
        names = [f"num__{c}" for c in self.numeric_columns]
        try:
            ohe = self.preprocessor.named_transformers_["cat"].named_steps["onehot"]
            names += list(ohe.get_feature_names_out(self.categorical_columns))
        except (AttributeError, KeyError):
            pass  # no categorical block in this preprocessor
        return names

    def _compute_version(self) -> str:
        digest = hashlib.sha256()
        for name in sorted(_ARTIFACTS):
            digest.update((self.model_dir / name).read_bytes())
        return digest.hexdigest()[:12]

    def get_explainer(self):
        return self._explainer_kind, self._explainer


# ---------------------------------------------------------------------------
# Prediction flow
# ---------------------------------------------------------------------------
def build_feature_frame(applicant: dict, feature_columns) -> pd.DataFrame:
    """One-row DataFrame aligned to training columns. Fields the API does not
    carry become NaN and are filled by the pipeline's imputers (population
    medians/modes learned at training time)."""
    row = {col: applicant.get(col, np.nan) for col in feature_columns}
    return pd.DataFrame([row], columns=feature_columns)


def preprocess(registry: ModelRegistry, frame: pd.DataFrame) -> np.ndarray:
    transformed = registry.preprocessor.transform(frame)
    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()
    return transformed


def predict_core(applicant: dict, registry: ModelRegistry | None = None) -> dict:
    """Score one applicant: probability + risk band + anomaly flag + fraud flags.

    This is the shared primitive used by BOTH /api/predict and /api/scenario
    - scenario logic never re-implements scoring.
    """
    registry = registry or ModelRegistry.get()
    frame = build_feature_frame(applicant, registry.feature_columns)
    x_row = preprocess(registry, frame)

    probability = float(registry.model.predict_proba(x_row)[0, 1])
    risk = categorize_risk(
        probability,
        low_threshold=registry.risk_low_threshold,
        high_threshold=registry.risk_high_threshold,
    )
    anomaly = anomaly_service.check_anomaly(registry.anomaly_model, x_row)

    from .fraud import detect_fraud_flags
    fraud = detect_fraud_flags(applicant)

    return {
        "risk": risk,
        "probability": round(probability, 4),
        "anomaly": anomaly["is_anomalous"],
        "anomaly_score": anomaly["score"],
        "is_suspicious": fraud["is_suspicious"],
        "fraud_flags": fraud["fraud_flags"],
        "fraud_severity": fraud["severity_score"],
        "model_version": registry.version,
        "_x_row": x_row,  # internal: reused by explanation step, popped before response
    }


def predict_application(applicant: dict, registry: ModelRegistry | None = None) -> dict:
    """Full single-applicant result incl. SHAP explanation (API-facing shape)."""
    registry = registry or ModelRegistry.get()
    result = predict_core(applicant, registry)
    x_row = result.pop("_x_row")
    result["explanation"] = explainability.explain(registry, x_row)
    return result


def predict_batch(applicants: list, registry: ModelRegistry | None = None) -> list:
    """Score many applicants in a single vectorized pass (one preprocess +
    one predict_proba + one isolation-forest score instead of N HTTP-style
    round trips). Returns a list of results identical in shape to
    predict_core output (including _x_row for the explanation step)."""
    registry = registry or ModelRegistry.get()

    frame = build_feature_frame_batch(applicants, registry.feature_columns)
    x_batch = preprocess(registry, frame)

    probabilities = registry.model.predict_proba(x_batch)[:, 1]
    risks = [
        categorize_risk(
            float(p),
            low_threshold=registry.risk_low_threshold,
            high_threshold=registry.risk_high_threshold,
        )
        for p in probabilities
    ]

    raw_pred = registry.anomaly_model.predict(x_batch)
    decision = registry.anomaly_model.decision_function(x_batch)
    unusualness = np.clip(0.5 - decision, 0, 1)

    from .fraud import detect_fraud_flags

    results = []
    for i in range(len(applicants)):
        fraud = detect_fraud_flags(applicants[i])
        results.append({
            "risk": risks[i],
            "probability": round(float(probabilities[i]), 4),
            "anomaly": bool(raw_pred[i] == -1),
            "anomaly_score": round(float(unusualness[i]), 4),
            "is_suspicious": fraud["is_suspicious"],
            "fraud_flags": fraud["fraud_flags"],
            "fraud_severity": fraud["severity_score"],
            "model_version": registry.version,
            "_x_row": x_batch[i],
        })
    return results


def build_feature_frame_batch(applicants: list, feature_columns) -> pd.DataFrame:
    """Multi-row version of build_feature_frame."""
    cols = list(feature_columns)
    data = [
        {col: applicant.get(col, np.nan) for col in cols}
        for applicant in applicants
    ]
    return pd.DataFrame(data, columns=cols)


def run_scenario(original: dict, modified: dict) -> dict:
    """What-if comparison. Calls the same scoring primitive twice - the only
    difference between before/after is the applicant payload.

    Returns explanations for both original and modified, anomaly scores,
    derived features, and risk score on a 0-1000 scale."""
    registry = ModelRegistry.get()
    before = predict_core(original, registry)
    after = predict_core(modified, registry)

    before_x = before.pop("_x_row")
    after_x = after.pop("_x_row")

    before_explanation = explainability.explain(registry, before_x)
    after_explanation = explainability.explain(registry, after_x)

    changed_fields = [
        {"field": key, "before": original.get(key), "after": modified.get(key)}
        for key in original
        if original.get(key) != modified.get(key)
    ]

    return {
        "original_risk": before["risk"],
        "new_risk": after["risk"],
        "original_probability": before["probability"],
        "new_probability": after["probability"],
        "probability_delta": round(after["probability"] - before["probability"], 4),
        "original_anomaly": before.get("anomaly", False),
        "new_anomaly": after.get("anomaly", False),
        "original_anomaly_score": before.get("anomaly_score", 0),
        "new_anomaly_score": after.get("anomaly_score", 0),
        "original_explanation": before_explanation,
        "new_explanation": after_explanation,
        "risk_changed": before["risk"] != after["risk"],
        "changed_fields": changed_fields,
        "model_version": after["model_version"],
    }
