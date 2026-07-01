import os
import sys
import json
import boto3
import logging
from datetime import datetime, timedelta
from decimal import Decimal

# detector.py lives in the same directory — add to path for Lambda runtime
sys.path.insert(0, os.path.dirname(__file__))
from detector import is_anomaly

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION        = os.environ.get("AWS_REGION", "ap-south-1")
AGG_TABLE     = os.environ.get("DYNAMODB_AGG_TABLE", "cost_aggregated")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
Z_THRESHOLD   = float(os.environ.get("Z_SCORE_THRESHOLD", "2.5"))
SPIKE_PCT     = float(os.environ.get("SPIKE_THRESHOLD_PCT", "40"))
MIN_COST_FLOOR = float(os.environ.get("MIN_COST_FLOOR", "1.0"))
DASHBOARD_URL = os.environ.get("DASHBOARD_BASE_URL", "https://localhost:3000")

# Lazy globals
_agg_table  = None
_sns_client = None


def get_agg_table():
    global _agg_table
    if _agg_table is None:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        _agg_table = dynamodb.Table(AGG_TABLE)
    return _agg_table


def get_sns_client():
    global _sns_client
    if _sns_client is None:
        _sns_client = boto3.client("sns", region_name=REGION)
    return _sns_client


def fetch_today_records(target_date: str) -> list[dict]:
    """Query cost_aggregated for all services on the target date."""
    table = get_agg_table()
    response = table.query(
        KeyConditionExpression="#d = :date",
        ExpressionAttributeNames={"#d": "date"},
        ExpressionAttributeValues={":date": target_date}
    )
    return response.get("Items", [])


def fetch_service_history(service: str, end_date: str, days: int = 30) -> list[float]:
    """
    Query cost_aggregated GSI for historical costs of a service.
    Excludes the current date (we only want prior history for the baseline).
    """
    table = get_agg_table()
    start_date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        response = table.query(
            IndexName="service-date-index",
            KeyConditionExpression="#svc = :svc AND #d BETWEEN :start AND :end",
            ExpressionAttributeNames={"#svc": "service", "#d": "date"},
            ExpressionAttributeValues={
                ":svc": service,
                ":start": start_date,
                ":end": end_date
            },
            ScanIndexForward=True  # oldest first
        )
    except Exception as e:
        logger.warning(f"GSI query failed for {service}: {e}")
        return []

    # Exclude today's record from history — we only want prior data
    history = [
        float(item["total_cost"])
        for item in response.get("Items", [])
        if item["date"] != end_date
    ]
    return history


def publish_anomaly_to_sns(service: str, date: str, anomaly_result: dict, today_cost: float):
    """Publish anomaly details to SNS for downstream consumers (Slack, email)."""
    if not SNS_TOPIC_ARN:
        logger.warning("SNS_TOPIC_ARN not set — skipping publish")
        return

    message = {
        "service": service,
        "date": date,
        "cost_today": today_cost,
        "baseline_avg": anomaly_result.get("baseline_30d_avg"),
        "baseline_std": anomaly_result.get("baseline_30d_std"),
        "z_score": anomaly_result.get("z_score"),
        "pct_change_7d": anomaly_result.get("pct_change_7d"),
        "anomaly_reason": anomaly_result.get("anomaly_reason"),
        "dashboard_link": f"{DASHBOARD_URL}/service/{service}?date={date}"
    }

    get_sns_client().publish(
        TopicArn=SNS_TOPIC_ARN,
        Subject=f"FinOps Alert — {service}",
        Message=json.dumps(message)
    )
    logger.info(f"Published anomaly alert for {service} to SNS")


def lambda_handler(event, context):
    """
    Anomaly Detector Lambda — reads today's aggregated records,
    runs anomaly detection, updates records, publishes to SNS.
    """
    # Allow date override via event payload (for manual testing)
    target_date = event.get("date") if event else None
    if not target_date:
        target_date = (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d")

    logger.info(f"Running anomaly detection for {target_date}")

    records = fetch_today_records(target_date)
    logger.info(f"Found {len(records)} service records for {target_date}")

    if not records:
        return {
            "statusCode": 200,
            "target_date": target_date,
            "services_checked": 0,
            "anomalies_found": 0
        }

    table = get_agg_table()
    anomalies_found = 0

    for record in records:
        service = record["service"]
        today_cost = float(record["total_cost"])

        # Get historical data (excluding today)
        history = fetch_service_history(service, target_date, days=30)

        # Run anomaly detection
        result = is_anomaly(
            today_cost=today_cost,
            history=history,
            z_threshold=Z_THRESHOLD,
            spike_pct=SPIKE_PCT,
            min_cost_floor=MIN_COST_FLOOR
        )

        # Update the record in cost_aggregated with anomaly results
        update_expr = "SET is_anomaly = :anom, anomaly_reason = :reason"
        expr_values = {
            ":anom": result["is_anomaly"],
            ":reason": result["anomaly_reason"] if result["anomaly_reason"] else "none"
        }

        # Also update computed fields if available
        if result["z_score"] is not None:
            update_expr += ", z_score = :z"
            expr_values[":z"] = Decimal(str(result["z_score"]))
        if result["pct_change_7d"] is not None:
            update_expr += ", pct_change_7d = :pct"
            expr_values[":pct"] = Decimal(str(result["pct_change_7d"]))
        if result["baseline_30d_avg"] is not None:
            update_expr += ", baseline_30d_avg = :b30avg"
            expr_values[":b30avg"] = Decimal(str(result["baseline_30d_avg"]))
        if result["baseline_30d_std"] is not None:
            update_expr += ", baseline_30d_std = :b30std"
            expr_values[":b30std"] = Decimal(str(result["baseline_30d_std"]))
        if result["baseline_7d_avg"] is not None:
            update_expr += ", baseline_7d_avg = :b7avg"
            expr_values[":b7avg"] = Decimal(str(result["baseline_7d_avg"]))

        table.update_item(
            Key={"date": target_date, "service": service},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )

        # Publish to SNS if anomaly detected
        if result["is_anomaly"]:
            anomalies_found += 1
            publish_anomaly_to_sns(service, target_date, result, today_cost)

    logger.info(f"Detection complete: {len(records)} checked, {anomalies_found} anomalies found")

    return {
        "statusCode": 200,
        "target_date": target_date,
        "services_checked": len(records),
        "anomalies_found": anomalies_found
    }
