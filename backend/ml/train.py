"""Offline training pipeline. Run:  python -m ml.train   (from backend/)

Steps: load CSV -> normalise target -> split (stratified) -> fit shared
preprocessor on TRAIN ONLY -> compare LR/RF/XGBoost on ROC-AUC+F1 ->
train IsolationForest on processed training features -> persist
credit_model.pkl / isolation_forest.pkl / preprocessor.pkl / metadata.json.

Deliberately framework-free and Flask-free so it can run in CI or a notebook
context without the web stack.
"""

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
)
from sklearn.model_selection import train_test_split

from .preprocessing import build_preprocessor

try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

BACKEND_DIR = Path(__file__).resolve().parent.parent

TARGET_CANDIDATES = ("class", "risk", "target", "credit_risk")
TARGET_MAPS = {
    "class": {"good": 0, "bad": 1},
    "risk": {"good": 0, "bad": 1},
}
CONTAMINATION = 0.05
RANDOM_STATE = 42


def load_dataset(path: Path) -> tuple[pd.DataFrame, str]:
    df = pd.read_csv(path)
    if df.empty:
        raise SystemExit(f"Dataset {path} is empty.")
    target = next((c for c in TARGET_CANDIDATES if c in df.columns), None)
    if target is None:
        raise SystemExit(
            f"No target column found in {list(df.columns)}. "
            f"Looked for: {TARGET_CANDIDATES}."
        )
    mapping = TARGET_MAPS.get(target)
    if mapping:
        df[target] = df[target].astype(str).str.lower().map(mapping)
    else:
        df[target] = pd.to_numeric(df[target]).astype(int)
    if df[target].isnull().any():
        raise SystemExit(f"Target column '{target}' has unmapped values.")
    print(f"[data] {path} | rows={len(df)} | target='{target}' "
          f"| distribution={df[target].value_counts().to_dict()}")
    return df, target


def build_candidates():
    candidates = {
        "logistic_regression": LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
        "random_forest": RandomForestClassifier(
            n_estimators=300, max_depth=8, random_state=RANDOM_STATE, n_jobs=-1,
        ),
    }
    if XGBOOST_AVAILABLE:
        candidates["xgboost"] = XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.08,
            eval_metric="logloss", random_state=RANDOM_STATE,
        )
    return candidates


def calculate_group_metrics(groups: dict, y_true: pd.Series, y_pred: np.ndarray) -> dict:
    group_results = {}
    for group_name, mask in groups.items():
        g_true = y_true[mask].to_numpy()
        g_pred = y_pred[mask]
        n = int(len(g_true))
        if n == 0:
            continue
        n_approved = int(np.sum(g_pred == 0))
        approval_rate = round(n_approved / n, 4)
        
        tp = int(np.sum((g_true == 0) & (g_pred == 0)))
        fp = int(np.sum((g_true == 1) & (g_pred == 0)))
        fn = int(np.sum((g_true == 0) & (g_pred == 1)))
        tn = int(np.sum((g_true == 1) & (g_pred == 1)))
        
        actual_good = tp + fn
        tpr = round(tp / actual_good, 4) if actual_good > 0 else 0.0
        actual_bad = fp + tn
        fpr = round(fp / actual_bad, 4) if actual_bad > 0 else 0.0
        fnr = round(fn / actual_good, 4) if actual_good > 0 else 0.0
        
        group_results[group_name] = {
            "n": n,
            "approval_rate": approval_rate,
            "true_positive_rate": tpr,
            "false_positive_rate": fpr,
            "false_negative_rate": fnr,
        }
        
    keys = list(group_results.keys())
    if len(keys) == 2:
        g1, g2 = keys[0], keys[1]
        dp_diff = round(abs(group_results[g1]["approval_rate"] - group_results[g2]["approval_rate"]), 4)
        eo_diff = round(abs(group_results[g1]["true_positive_rate"] - group_results[g2]["true_positive_rate"]), 4)
    else:
        dp_diff = 0.0
        eo_diff = 0.0
        
    status = "NORMAL"
    if dp_diff > 0.15 or eo_diff > 0.10:
        status = "WARNING"
    if dp_diff > 0.25 or eo_diff > 0.20:
        status = "ALERT"
        
    return {
        "available": True,
        "status": status,
        "demographic_parity_difference": dp_diff,
        "equal_opportunity_difference": eo_diff,
        "group_metrics": group_results,
        "disclaimer": "Fairness metrics are monitoring indicators calculated on the validation test set."
    }


def compute_fairness_audit(X_test: pd.DataFrame, y_test: pd.Series, pred: np.ndarray) -> dict:
    audits = {}
    if "age" in X_test.columns:
        is_young = X_test["age"] < 30
        groups = {
            "Young (Age < 30)": is_young,
            "Older (Age >= 30)": ~is_young
        }
        audits["age"] = calculate_group_metrics(groups, y_test, pred)
        
    if "personal_status" in X_test.columns:
        is_female = X_test["personal_status"].astype(str).str.contains("female", case=False)
        groups = {
            "Female": is_female,
            "Male": ~is_female
        }
        audits["gender"] = calculate_group_metrics(groups, y_test, pred)
        
    return audits


def main():
    parser = argparse.ArgumentParser(description="Train credit-risk artifacts")
    parser.add_argument("--data", type=Path,
                        default=BACKEND_DIR / "data" / "german_credit.csv")
    parser.add_argument("--out", type=Path,
                        default=Path(__file__).resolve().parent / "artifacts")
    args = parser.parse_args()

    df, target = load_dataset(args.data)

    feature_columns = [c for c in df.columns if c != target]
    X, y = df[feature_columns], df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y,
    )

    print("[prep] fitting shared preprocessor on TRAIN only ...")
    preprocessor, numeric_cols, categorical_cols = build_preprocessor(X_train, feature_columns)
    X_train_p = preprocessor.fit_transform(X_train)
    X_test_p = preprocessor.transform(X_test)
    if hasattr(X_train_p, "toarray"):
        X_train_p, X_test_p = X_train_p.toarray(), X_test_p.toarray()

    results = {}
    fitted = {}
    for name, model in build_candidates().items():
        model.fit(X_train_p, y_train)
        proba = model.predict_proba(X_test_p)[:, 1]
        pred = (proba >= 0.5).astype(int)
        
        acc = round(float(accuracy_score(y_test, pred)), 4)
        prec = round(float(precision_score(y_test, pred, zero_division=0)), 4)
        rec = round(float(recall_score(y_test, pred, zero_division=0)), 4)
        f1 = round(float(f1_score(y_test, pred, zero_division=0)), 4)
        auc = round(float(roc_auc_score(y_test, proba)), 4)
        pr_auc = round(float(average_precision_score(y_test, proba)), 4)
        brier = round(float(brier_score_loss(y_test, proba)), 4)
        calibration_quality = "Good" if brier <= 0.15 else ("Fair" if brier <= 0.20 else "Poor")
        
        metrics = {
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "roc_auc": auc,
            "pr_auc": pr_auc,
            "brier_score": brier,
            "calibration_quality": calibration_quality
        }
        results[name] = metrics
        fitted[name] = model
        print(f"  {name}: {metrics}")

    best_name = max(results, key=lambda n: (results[n]["roc_auc"], results[n]["f1"]))
    best_model = fitted[best_name]
    print(f"[model] selected: {best_name}")

    # Compute fairness audit using the best model's predictions
    best_proba = best_model.predict_proba(X_test_p)[:, 1]
    best_pred = (best_proba >= 0.5).astype(int)
    fairness_report = compute_fairness_audit(X_test, y_test, best_pred)

    anomaly_model = IsolationForest(
        contamination=CONTAMINATION, random_state=RANDOM_STATE, n_estimators=200,
    ).fit(X_train_p)
    print("[anomaly] IsolationForest trained on processed training features.")

    args.out.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, args.out / "credit_model.pkl")
    joblib.dump(anomaly_model, args.out / "isolation_forest.pkl")
    joblib.dump(preprocessor, args.out / "preprocessor.pkl")

    metadata = {
        "selected_model": best_name,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_path": str(args.data),
        "n_rows": int(len(df)),
        "target_column": target,
        "target_mapping": TARGET_MAPS.get(target),
        "feature_columns": feature_columns,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "candidate_metrics": results,
        "fairness_audit": fairness_report,
        "contamination": CONTAMINATION,
        "random_state": RANDOM_STATE,
        "python": platform.python_version(),
    }
    with open(args.out / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)
    print(f"[done] artifacts written to {args.out}")


if __name__ == "__main__":
    main()
