"""Fraud detection rules engine.

Analyzes borrower profile details (income, existing debt, employment, age)
for logical contradictions and high-risk flags.
"""

def detect_fraud_flags(applicant: dict) -> dict:
    """Analyze applicant data for potential fraud/logical inconsistencies.
    
    Returns a dict with:
      - is_suspicious: bool
      - fraud_flags: list of strings
      - severity_score: float (0.0 to 1.0)
    """
    flags = []
    
    age = applicant.get("age")
    income = applicant.get("income")
    existing_debt = applicant.get("existing_debt")
    loan_amount = applicant.get("loan_amount")
    
    job = applicant.get("job", "")
    employment_type = applicant.get("employment_type", "")
    
    credit_history_years = applicant.get("credit_history_years")
    employment_duration_years = applicant.get("employment_duration_years")
    
    # 1. Income Inflation Suspicion: Unemployed or retired but high income
    is_unemployed_or_retired = (
        employment_type in ["RETIRED"] or 
        job in ["unemp/unskilled non res", "unskilled resident"]
    )
    if is_unemployed_or_retired and income and income > 120000:
        flags.append("INCOME_INFLATION_SUSPICION")
        
    # 2. Excessive Loan-to-Income (LTI) ratio: Loan > 1.5x annual income
    if loan_amount and income and income > 0:
        lti = loan_amount / income
        if lti > 1.5:
            flags.append("EXCESSIVE_LOAN_TO_INCOME")
            
    # 3. High Debt-to-Income (DTI) ratio: Debt > 85% of annual income
    if existing_debt and income and income > 0:
        dti = existing_debt / income
        if dti > 0.85:
            flags.append("HIGH_DEBT_TO_INCOME")
            
    # 4. Credit History Length vs Age: e.g. age < 23 but credit history > 4 years
    if age and credit_history_years:
        if age < 23 and credit_history_years > 4:
            flags.append("SUSPICIOUS_CREDIT_HISTORY_LENGTH")
            
    # 5. Employment Duration vs Age
    if age and employment_duration_years:
        if age < 22 and employment_duration_years > 4:
            flags.append("SUSPICIOUS_EMPLOYMENT_LENGTH")
            
    severity_score = min(1.0, len(flags) * 0.25)
    
    return {
        "is_suspicious": len(flags) > 0,
        "fraud_flags": flags,
        "severity_score": round(severity_score, 2)
    }
