# terraform/modules/lambda/src/anomaly_detector/detector.py
import statistics
from typing import Optional

def calculate_z_score(today_cost: float, history: list[float]) -> Optional[float]:
    if len(history) < 7:
        return None
    mean = statistics.mean(history)
    try:
        std = statistics.stdev(history)
    except statistics.StatisticsError:
        return None
    if std == 0:
        return None
    return (today_cost - mean) / std


def calculate_pct_change(today_cost: float, history: list[float], window: int = 7) -> Optional[float]:
    if len(history) < window:
        return None
    recent_mean = statistics.mean(history[-window:])
    if recent_mean == 0:
        return None
    return ((today_cost - recent_mean) / recent_mean) * 100


def is_anomaly(
    today_cost: float,
    history: list[float],
    z_threshold: float = 2.5,
    spike_pct: float = 40.0,
    min_cost_floor: float = 1.0
) -> dict:
    result = {
        "is_anomaly": False,
        "anomaly_reason": None,
        "z_score": None,
        "pct_change_7d": None,
        "skip_reason": None,
        "baseline_30d_avg": None,
        "baseline_30d_std": None,
        "baseline_7d_avg": None,
    }

    # Compute baseline stats regardless — dashboard always wants these
    if len(history) >= 7:
        result["baseline_7d_avg"] = round(statistics.mean(history[-7:]), 4)
    if len(history) >= 2:
        result["baseline_30d_avg"] = round(statistics.mean(history), 4)
        try:
            result["baseline_30d_std"] = round(statistics.stdev(history), 4)
        except statistics.StatisticsError:
            pass

    # Cold start — not enough data to run checks
    if len(history) < 7:
        result["skip_reason"] = "insufficient_data"
        return result

    # Thin baseline (7-29 days) — raise threshold to reduce false positives
    effective_z_threshold = z_threshold if len(history) >= 30 else z_threshold + 0.5

    # Condition 1: Z-score
    z = calculate_z_score(today_cost, history)
    result["z_score"] = round(z, 4) if z is not None else None

    if z is not None and abs(z) > effective_z_threshold:
        result["is_anomaly"] = True
        result["anomaly_reason"] = (
            f"Z-score: {z:.2f} exceeds threshold {effective_z_threshold}"
        )

    # Condition 2: Percentage spike (only if above cost floor)
    if today_cost >= min_cost_floor:
        pct = calculate_pct_change(today_cost, history, window=7)
        result["pct_change_7d"] = round(pct, 2) if pct is not None else None

        if pct is not None and pct > spike_pct:
            result["is_anomaly"] = True
            reason = f"Spike: {pct:.1f}% above 7-day average"
            result["anomaly_reason"] = (
                result["anomaly_reason"] + f" | {reason}"
                if result["anomaly_reason"]
                else reason
            )

    return result