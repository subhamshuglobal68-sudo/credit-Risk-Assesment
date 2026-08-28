"""Per-prediction explanations.

Primary path: SHAP TreeExplainer, built ONCE and cached on the model
registry (building it per request would dominate latency). If the selected
model is not tree-based or shap is unavailable/fails, falls back to a
global feature-importance heuristic that is always clearly labeled as a
fallback - never presented as true local SHAP output."""

import logging

import numpy as np

logger = logging.getLogger(__name__)

TOP_N = 6
_TREE_HINTS = ("forest", "xgb", "gbm", "gradientboost", "tree", "boosting")


def _is_tree_model(model) -> bool:
    name = type(model).__name__.lower()
    return any(hint in name for hint in _TREE_HINTS)


def build_explainer(model, x_background=None):
    """Build a SHAP explainer ONCE, matched to the model family:
    tree models -> TreeExplainer; linear models -> LinearExplainer over a
    preprocessed background sample. Returns (kind, explainer) or (None, None),
    in which case callers use the labeled importance fallback."""
    import importlib.util

    if importlib.util.find_spec("shap") is None:
        logger.warning("shap not installed; using fallback explanations.")
        return None, None
    import shap

    try:
        if _is_tree_model(model):
            return "tree", shap.TreeExplainer(model)
        if hasattr(model, "coef_") and x_background is not None:
            return "linear", shap.LinearExplainer(model, x_background)
    except Exception as exc:  # noqa: BLE001 - shap can fail on exotic models/versions
        logger.warning("Could not build SHAP explainer (%s); using fallback.", exc)
    return None, None


def _extract_shap_values(kind, explainer, x_row):
    """Normalize SHAP output across explainers/model wrappers to a flat
    array of contributions for the positive (default/bad credit) class."""
    if kind == "tree":
        shap_values = explainer.shap_values(x_row)
    else:
        explanation = explainer(x_row)
        shap_values = getattr(explanation, "values", explanation)

    if isinstance(shap_values, list):
        return np.array(shap_values[1])[0]  # binary list -> class 1
    arr = np.array(shap_values)
    if arr.ndim == 3:
        return arr[0, :, 1]
    if arr.ndim == 2:
        return arr[0]
    raise ValueError(f"Unexpected SHAP output shape: {arr.shape}")


def explain_with_fallback(model, feature_names, x_row):
    """Global-importance x standardized-value pseudo-contributions."""
    if hasattr(model, "feature_importances_"):
        importances = np.asarray(model.feature_importances_)
    elif hasattr(model, "coef_"):
        importances = np.abs(np.asarray(model.coef_)).ravel()
    else:
        importances = np.ones(len(feature_names))

    values = np.asarray(x_row).ravel()
    contributions = list(zip(feature_names, importances * values, values))
    return _format_contributions(contributions, method="fallback_feature_importance")


def explain(registry, x_row):
    """Public entry point. Uses the cached SHAP explainer when available,
    otherwise the labeled fallback. Never raises to the caller."""
    feature_names = registry.feature_names_out
    kind, explainer = registry.get_explainer()
    if explainer is None:
        return explain_with_fallback(registry.model, feature_names, x_row)
    try:
        values = _extract_shap_values(kind, explainer, x_row)
        contributions = list(zip(feature_names, values, np.asarray(x_row).ravel()))
        return _format_contributions(contributions, method="shap")
    except Exception as exc:  # noqa: BLE001
        logger.warning("SHAP explanation failed (%s); using fallback.", exc)
        return explain_with_fallback(registry.model, feature_names, x_row)


def explain_batch(registry, x_batch):
    """Batch SHAP explanation for many rows in a single vectorized call.
    Returns a list of explanation dicts (same shape as explain()) matched to
    each row of x_batch. Falls back to per-row fallback on any error."""
    feature_names = registry.feature_names_out
    x_batch = np.asarray(x_batch)
    kind, explainer = registry.get_explainer()

    if explainer is not None:
        try:
            if kind == "tree":
                shap_values = explainer.shap_values(x_batch)
            else:
                explanation = explainer(x_batch)
                shap_values = getattr(explanation, "values", explanation)

            # Normalize to a 2D [n_samples, n_features] matrix for class 1.
            arr = np.array(shap_values)
            if isinstance(shap_values, list):
                arr = np.array(shap_values[1])  # binary list -> class 1
            if arr.ndim == 3:
                arr = arr[:, :, 1]
            if arr.ndim != 2 or arr.shape[0] != x_batch.shape[0]:
                raise ValueError(f"Unexpected SHAP batch shape: {arr.shape}")

            out = []
            for i in range(x_batch.shape[0]):
                contributions = list(
                    zip(feature_names, arr[i], np.asarray(x_batch)[i].ravel())
                )
                out.append(_format_contributions(contributions, method="shap"))
            return out
        except Exception as exc:  # noqa: BLE001
            logger.warning("Batch SHAP explanation failed (%s); using per-row fallback.", exc)

    return [
        explain_with_fallback(registry.model, feature_names, row)
        for row in x_batch
    ]


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------
def _human_label(feature_name):
    label = str(feature_name)
    for prefix in ("num__", "cat__"):
        if label.startswith(prefix):
            label = label[len(prefix):]
    return label.replace("_", " ").strip()


def _format_contributions(contributions, method):
    increasing = sorted(
        (c for c in contributions if c[1] > 0), key=lambda c: -c[1]
    )[:TOP_N]
    decreasing = sorted(
        (c for c in contributions if c[1] < 0), key=lambda c: c[1]
    )[:TOP_N]

    def fmt(items):
        out = []
        for name, contribution, value in items:
            value = round(float(value), 4)
            contribution = round(float(contribution), 4)
            out.append({
                "feature": _human_label(name),
                "value": value,
                "contribution": contribution,
                "explanation": (
                    f"{_human_label(name)} (value: {round(float(value), 3)}) "
                    f"{'increased' if contribution > 0 else 'decreased'} "
                    "the estimated risk of default."
                ),
            })
        return out

    body = {
        "method": method,
        "is_local_shap": method == "shap",
        "risk_increasing_factors": fmt(increasing),
        "risk_reducing_factors": fmt(decreasing),
    }
    if method != "shap":
        body["note"] = (
            "SHAP was unavailable for this model, so this explanation uses "
            "overall feature importance rather than true per-application "
            "attribution."
        )
    return body
