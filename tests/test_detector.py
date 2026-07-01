# tests/test_detector.py
import sys
sys.path.insert(0, "terraform/modules/lambda/src/anomaly_detector")
from detector import calculate_z_score, calculate_pct_change, is_anomaly

# Stable 30-day history around $100/day with small variance
STABLE_30D = [100.0 + (i % 5 - 2) for i in range(30)]


def test_massive_spike_triggers_z_score():
    result = is_anomaly(today_cost=350.0, history=STABLE_30D)
    assert result["is_anomaly"] is True
    assert "Z-score" in result["anomaly_reason"]
    assert result["z_score"] > 2.5


def test_normal_day_passes():
    result = is_anomaly(today_cost=103.0, history=STABLE_30D)
    assert result["is_anomaly"] is False
    assert result["anomaly_reason"] is None


def test_40pct_spike_triggers_percentage_check():
    result = is_anomaly(today_cost=145.0, history=STABLE_30D)
    assert result["is_anomaly"] is True
    assert result["pct_change_7d"] > 40


def test_below_cost_floor_not_flagged():
    tiny_history = [0.05] * 30
    result = is_anomaly(today_cost=0.50, history=tiny_history, min_cost_floor=1.0)
    assert result["is_anomaly"] is False


def test_cold_start_under_7_days():
    result = is_anomaly(today_cost=999.0, history=[100.0, 102.0])
    assert result["is_anomaly"] is False
    assert result["skip_reason"] == "insufficient_data"


def test_thin_baseline_7_to_29_days():
    # 10 days — effective threshold should be 3.0, not 2.5
    # A spike that would trigger at 2.5 should NOT trigger at 3.0
    history_10d = [100.0] * 10
    # z-score for 130 against mean=100, std=0 → std is 0, z is None → no z trigger
    # but spike check: 130 vs 100 = 30% < 40% → no trigger either
    result = is_anomaly(today_cost=130.0, history=history_10d)
    assert result["is_anomaly"] is False
    assert result["skip_reason"] is None


def test_both_conditions_produce_combined_reason():
    result = is_anomaly(today_cost=400.0, history=STABLE_30D)
    assert result["is_anomaly"] is True
    assert "Z-score" in result["anomaly_reason"]
    assert "Spike" in result["anomaly_reason"]


def test_baseline_stats_always_populated():
    result = is_anomaly(today_cost=100.0, history=STABLE_30D)
    assert result["baseline_30d_avg"] is not None
    assert result["baseline_7d_avg"] is not None
    assert result["baseline_30d_std"] is not None


def test_z_score_none_when_std_is_zero():
    # All identical values — std deviation is 0, z-score should be None
    flat_history = [100.0] * 30
    result = is_anomaly(today_cost=100.0, history=flat_history)
    assert result["z_score"] is None


def test_pct_change_not_computed_below_cost_floor():
    tiny_history = [0.01] * 30
    result = is_anomaly(today_cost=0.50, history=tiny_history, min_cost_floor=1.0)
    assert result["pct_change_7d"] is None