"""Risk banding: boundary behaviour + injected thresholds."""

from app.services.risk import HIGH, LOW, MEDIUM, categorize_risk


class TestRiskBanding:
    def test_just_below_low_threshold_is_low(self):
        assert categorize_risk(0.3299) == LOW

    def test_at_low_threshold_is_medium(self):
        assert categorize_risk(0.33) == MEDIUM

    def test_mid_range_is_medium(self):
        assert categorize_risk(0.5) == MEDIUM

    def test_just_below_high_threshold_is_medium(self):
        assert categorize_risk(0.6599) == MEDIUM

    def test_at_high_threshold_is_high(self):
        assert categorize_risk(0.66) == HIGH

    def test_extremes(self):
        assert categorize_risk(0.0) == LOW
        assert categorize_risk(1.0) == HIGH

    def test_labels_are_contract_strings(self):
        assert (LOW, MEDIUM, HIGH) == ("Low", "Medium", "High")


class TestInjectedThresholds:
    def test_custom_thresholds_shift_bands(self):
        assert categorize_risk(0.5, low_threshold=0.6, high_threshold=0.8) == LOW
        assert categorize_risk(0.7, low_threshold=0.6, high_threshold=0.8) == MEDIUM
        assert categorize_risk(0.85, low_threshold=0.6, high_threshold=0.8) == HIGH

    def test_degenerate_thresholds_route_everything_to_high(self):
        assert categorize_risk(0.01, low_threshold=0.0, high_threshold=0.0) == HIGH
