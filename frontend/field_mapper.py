"""Translation layer: frontend user-friendly fields <-> backend German Credit fields."""

from typing import Any, Dict, List


FRONTEND_TO_BACKEND_DEFAULTS = {
    # Neutral / average profile so applicants without these specific
    # columns are NOT defaulted to the worst possible credit standing
    # (which was the root cause of every application being rejected).
    "checking_status": "0<=X<200",
    "credit_history": "existing paid",
    "purpose": "radio/tv",
    "savings_status": "100<=X<500",
    "employment": ">=7",
    "installment_commitment": 4,
    "personal_status": "male single",
    "other_parties": "none",
    "residence_since": 4,
    "property_magnitude": "car",
    "other_payment_plans": "bank",
    "own_telephone": "yes",
    "foreign_worker": "yes",
    "num_dependents": 1,
    # Defaults for backend schema required fields
    "age": 35,
    "job": "skilled",
    "credit_amount": 5000.0,
    "duration": 24,
    "existing_credits": 1,
}

JOB_MAPPING = {
    "SALARIED": "skilled",
    "SELF_EMPLOYED": "high qualif/self emp/mgmt",
    "RETIRED": "unskilled resident",
}

# Converts frontend (default INR) monetary amounts into the German Credit
# model's native credit_amount scale (mean ~3,200, meaningful 0-10k spread).
# Kept in one place so single-predict, what-if and batch all agree.
AMOUNT_SCALE = 30.0

HOUSING_MAPPING = {
    "OWN": "own",
    "RENT": "rent",
    "MORTGAGE": "for free",
}


def map_frontend_to_backend(frontend_data: Dict[str, Any]) -> Dict[str, Any]:
    """Translate frontend's user-friendly fields to backend's German Credit fields."""
    backend_data = FRONTEND_TO_BACKEND_DEFAULTS.copy()

    # Monetary values are passed through on the model's native scale (the
    # preprocessor standardizes them anyway). No INR<->DM division is applied
    # here: dividing by a large rate produced unrealistically tiny
    # credit_amounts (e.g. 100 DM) far outside the training range, which the
    # model treated as extremely high risk for every applicant.
    currency = frontend_data.get("currency", "INR")

    if "age" in frontend_data:
        backend_data["age"] = int(frontend_data["age"])

    if "loan_amount" in frontend_data:
        # Scale the (typically INR) loan amount into the model's native
        # credit_amount range. The German Credit model was trained on amounts
        # centered ~3,200 with a meaningful 0-10k spread; feeding it a raw
        # 100k INR loan is ~15 sigma above the mean and so reads as near-100%
        # default risk for EVERY applicant. Dividing by AMOUNT_SCALE lands a
        # normal INR loan (roughly 30k-300k) in the 1k-10k range the model
        # actually understands.
        backend_data["credit_amount"] = float(frontend_data["loan_amount"]) / AMOUNT_SCALE

    if "employment_duration_years" in frontend_data:
        years = float(frontend_data["employment_duration_years"])
        if years < 1:
            backend_data["employment"] = "unemp/unskilled non res"
        elif years < 4:
            backend_data["employment"] = "1-4"
        elif years < 7:
            backend_data["employment"] = "4-7"
        else:
            backend_data["employment"] = ">=7"

    if "credit_history_years" in frontend_data:
        # Long (or clean) credit history is GOOD and must never downgrade to
        # the worst category. Was previously inverted, forcing rejections.
        years = float(frontend_data["credit_history_years"])
        if years <= 0:
            backend_data["credit_history"] = "no credits/all paid"
        elif years < 3:
            backend_data["credit_history"] = "all paid"
        elif years < 5:
            backend_data["credit_history"] = "existing paid"
        else:
            backend_data["credit_history"] = "all paid"

    if "num_open_accounts" in frontend_data:
        # Backend validation requires existing_credits in [1..10]; clamp so a
        # value of 0 (empty slider edge) never produces an invalid payload.
        backend_data["existing_credits"] = int(max(1, min(int(frontend_data["num_open_accounts"]), 10)))

    if "housing_status" in frontend_data:
        backend_data["housing"] = HOUSING_MAPPING.get(
            frontend_data["housing_status"], "rent"
        )

    if "employment_type" in frontend_data:
        backend_data["job"] = JOB_MAPPING.get(
            frontend_data["employment_type"], "skilled"
        )

    if "income" in frontend_data:
        income = float(frontend_data["income"])
        # Income-based checking/savings standing. Thresholds tuned to a
        # reasonable spread over common (INR-equivalent) income values so a
        # well-off applicant is not pushed to the lowest tiers.
        if income > 200000:
            backend_data["checking_status"] = ">=200"
            backend_data["savings_status"] = ">=1000"
            backend_data["own_telephone"] = "yes"
        elif income > 100000:
            backend_data["checking_status"] = ">=200"
            backend_data["savings_status"] = "500<=X<1000"
            backend_data["own_telephone"] = "yes"
        elif income > 60000:
            backend_data["checking_status"] = "0<=X<200"
            backend_data["savings_status"] = "100<=X<500"
        elif income > 30000:
            backend_data["checking_status"] = "0<=X<200"
            backend_data["savings_status"] = "<100"
        else:
            backend_data["checking_status"] = "<0"
            backend_data["savings_status"] = "no known savings"

    if "existing_debt" in frontend_data:
        debt = float(frontend_data["existing_debt"])
        income = float(frontend_data.get("income", 0) or 0)
        # DTI-based installment commitment (1 = high burden ... 4 = low burden).
        # Debt and income are in frontend (INR) units; DTI handles currency
        # implicitly, and absolute debt thresholds are set to common INR levels.
        if income > 0 and debt / (income or 1) > 0.5:
            backend_data["installment_commitment"] = 1
        elif debt > 500000:
            backend_data["installment_commitment"] = 1
        elif debt > 200000:
            backend_data["installment_commitment"] = 2
        elif debt > 80000:
            backend_data["installment_commitment"] = 3
        else:
            backend_data["installment_commitment"] = 4

    if frontend_data.get("late_payments_last_2y"):
        late = int(frontend_data["late_payments_last_2y"])
        if late >= 3:
            backend_data["credit_history"] = "critical/other existing credit"
        elif late >= 1:
            backend_data["credit_history"] = "delayed previously"

    # Estimate loan duration in months based on loan amount. Use the model
    # scale for consistency (the / AMOUNT_SCALE mirrors credit_amount above).
    if "loan_amount" in frontend_data:
        loan_amt = float(frontend_data["loan_amount"]) / AMOUNT_SCALE
        if loan_amt > 30000:
            backend_data["duration"] = 60
        elif loan_amt > 15000:
            backend_data["duration"] = 48
        elif loan_amt > 8000:
            backend_data["duration"] = 36
        else:
            backend_data["duration"] = 24
    else:
        backend_data["duration"] = 24

    return backend_data


def map_backend_response_to_frontend(
    backend_response: Dict[str, Any], frontend_inputs: Dict[str, Any]
) -> Dict[str, Any]:
    """Translate backend response to frontend's expected format."""
    prob = backend_response.get("probability", 0.0)
    risk = backend_response.get("risk", "Medium")
    is_anomalous = backend_response.get("anomaly", False)
    anomaly_score = backend_response.get("anomaly_score", 0.0)
    explanation = backend_response.get("explanation", {})
    model_version = backend_response.get("model_version", "unknown")

    if risk == "Low":
        risk_category = "LOW"
        recommendation = "APPROVE"
        risk_score = int(700 + (1 - prob) * 300)
    elif risk == "Medium":
        risk_category = "MEDIUM"
        recommendation = "REVIEW"
        risk_score = int(500 + (1 - prob) * 200)
    else:
        risk_category = "HIGH"
        recommendation = "REJECT"
        risk_score = int(prob * 500)

    loan_amount = frontend_inputs.get("loan_amount", 50000)
    expected_loss = round(prob * loan_amount * 0.45, 2)

    inc_factors = explanation.get("risk_increasing_factors", [])
    dec_factors = explanation.get("risk_reducing_factors", [])

    decision_reasons = []
    if inc_factors:
        decision_reasons.append(
            f"Key risk factor: {inc_factors[0].get('explanation', 'Unknown')}"
        )
    if dec_factors:
        decision_reasons.append(
            f"Mitigating factor: {dec_factors[0].get('explanation', 'Unknown')}"
        )
    if not decision_reasons:
        decision_reasons = [
            "Credit assessment based on financial profile and credit history."
        ]

    anomaly_label = "Normal"
    if is_anomalous:
        if anomaly_score > 0.7:
            anomaly_label = "High Anomaly"
        elif anomaly_score > 0.4:
            anomaly_label = "Moderate Anomaly"
        else:
            anomaly_label = "Slight Anomaly"

    return {
        "risk_score": min(1000, max(0, risk_score)),
        "probability_of_default": round(prob, 4),
        "risk_category": risk_category,
        "recommendation": recommendation,
        "expected_loss": expected_loss,
        "anomaly": {
            "is_anomalous": bool(is_anomalous),
            "anomaly_score": round(float(anomaly_score), 3),
            "label": anomaly_label,
            "flags": [],
        },
        "decision_reasons": decision_reasons,
        "decision_thresholds": {"approve_score_min": 700, "reject_score_below": 500},
        "model_version": model_version,
        "explanation": {
            "risk_increasing_factors": [
                {
                    "feature": f.get("feature", "unknown"),
                    "explanation": f.get("explanation", ""),
                }
                for f in inc_factors
            ],
            "risk_reducing_factors": [
                {
                    "feature": f.get("feature", "unknown"),
                    "explanation": f.get("explanation", ""),
                }
                for f in dec_factors
            ],
            "disclaimer": explanation.get(
                "disclaimer",
                "Explanations are based on SHAP values from the trained model.",
            ),
        },
        "currency": frontend_inputs.get("currency", "INR"),
        "display": {"expected_loss": expected_loss, "monetary_values": {}},
    }


def map_backend_scenario_to_frontend(
    backend_response: Dict[str, Any], original_inputs: Dict[str, Any], modified_inputs: Dict[str, Any]
) -> Dict[str, Any]:
    """Translate backend scenario response to frontend format."""
    orig_prob = backend_response.get("original_probability", 0.0)
    new_prob = backend_response.get("new_probability", 0.0)
    orig_risk = backend_response.get("original_risk", "Medium")
    new_risk = backend_response.get("new_risk", "Medium")
    model_version = backend_response.get("model_version", "unknown")

    def risk_to_score(r: str, p: float) -> int:
        if r == "Low":
            return int(700 + (1 - p) * 300)
        elif r == "Medium":
            return int(500 + (1 - p) * 200)
        else:
            return int(p * 500)

    def risk_to_category(r: str) -> str:
        return {"Low": "APPROVE", "Medium": "REVIEW", "High": "HIGH RISK"}.get(r, "REVIEW")

    orig_score = risk_to_score(orig_risk, orig_prob)
    new_score = risk_to_score(new_risk, new_prob)

    orig_explanation = backend_response.get("original_explanation", {})
    new_explanation = backend_response.get("new_explanation", {})

    orig_inc = orig_explanation.get("risk_increasing_factors", [])
    orig_dec = orig_explanation.get("risk_reducing_factors", [])
    new_inc = new_explanation.get("risk_increasing_factors", [])
    new_dec = new_explanation.get("risk_reducing_factors", [])

    changed = []
    for k in modified_inputs:
        if k in original_inputs and modified_inputs[k] != original_inputs[k]:
            changed.append({"field": k, "before": original_inputs[k], "after": modified_inputs[k]})

    return {
        "before": {
            "risk_score": min(1000, max(0, orig_score)),
            "probability_of_default": round(orig_prob, 4),
            "risk_category": risk_to_category(orig_risk),
            "risk_label": orig_risk,
            "recommendation": risk_to_category(orig_risk),
            "anomaly": {
                "is_anomalous": bool(backend_response.get("original_anomaly", False)),
                "anomaly_score": round(float(backend_response.get("original_anomaly_score", 0)), 3),
            },
            "explanation": {
                "risk_increasing_factors": [{"feature": f.get("feature", "unknown"), "explanation": f.get("explanation", "")} for f in orig_inc],
                "risk_reducing_factors": [{"feature": f.get("feature", "unknown"), "explanation": f.get("explanation", "")} for f in orig_dec],
            },
        },
        "after": {
            "risk_score": min(1000, max(0, new_score)),
            "probability_of_default": round(new_prob, 4),
            "risk_category": risk_to_category(new_risk),
            "risk_label": new_risk,
            "recommendation": risk_to_category(new_risk),
            "anomaly": {
                "is_anomalous": bool(backend_response.get("new_anomaly", False)),
                "anomaly_score": round(float(backend_response.get("new_anomaly_score", 0)), 3),
            },
            "explanation": {
                "risk_increasing_factors": [{"feature": f.get("feature", "unknown"), "explanation": f.get("explanation", "")} for f in new_inc],
                "risk_reducing_factors": [{"feature": f.get("feature", "unknown"), "explanation": f.get("explanation", "")} for f in new_dec],
            },
        },
        "change": {
            "risk_score_delta": new_score - orig_score,
            "probability_delta": round(new_prob - orig_prob, 4),
            "category_changed": risk_to_category(orig_risk) != risk_to_category(new_risk),
            "from_category": risk_to_category(orig_risk),
            "to_category": risk_to_category(new_risk),
        },
        "changed_fields": changed,
        "model_version": model_version,
    }