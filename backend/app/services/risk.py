"""Risk banding: maps a probability of default to a Low/Medium/High label.
Thresholds are injected by callers (from config) - no Flask, no globals."""

LOW = "Low"
MEDIUM = "Medium"
HIGH = "High"


def categorize_risk(probability: float,
                    low_threshold: float = 0.33,
                    high_threshold: float = 0.66) -> str:
    """< low_threshold -> Low; < high_threshold -> Medium; else High."""
    if probability < low_threshold:
        return LOW
    if probability < high_threshold:
        return MEDIUM
    return HIGH
