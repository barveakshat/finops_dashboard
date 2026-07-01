import os
import boto3
import logging
import statistics
from datetime import datetime, timedelta
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION     = os.environ.get("AWS_REGION", "ap-south-1")
RAW_TABLE  = os.environ.get("DYNAMODB_RAW_TABLE", "cost_raw")
AGG_TABLE  = os.environ.get("DYNAMODB_AGG_TABLE", "cost_aggregated")
ACCOUNT_ID = os.environ.get("ACCOUNT_ID", "")
RETENTION_DAYS = int(os.environ.get("DATA_RETENTION_DAYS", "90"))

# Lazy globals — initialized on first call, not at import time
_raw_table = None
_agg_table = None


def get_raw_table():
    global _raw_table
    if _raw_table is None:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        _raw_table = dynamodb.Table(RAW_TABLE)
    return _raw_table


def get_agg_table():
    global _agg_table
    if _agg_table is None:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        _agg_table = dynamodb.Table(AGG_TABLE)
    return _agg_table


def get_target_date(lookback_days: int = 2) -> str:
    """Returns the target date as ISO string (T-2 by default)."""
    return (datetime.utcnow() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")


def build_ttl() -> int:
    return int((datetime.utcnow() + timedelta(days=RETENTION_DAYS)).timestamp())


def fetch_raw_records_for_date(target_date: str) -> dict[str, float]:
    """
    Scan cost_raw for all records matching the target date.
    Returns a dict of {service_name: cost_usd}.
    Only includes service-dimension records (not tag-dimension).
    """
    raw_table = get_raw_table()

    # Scan and filter — at our scale this is fine (< 50 records/day)
    response = raw_table.scan(
        FilterExpression="#d = :date AND begins_with(service_account, :not_tag)",
        ExpressionAttributeNames={"#d": "date"},
        ExpressionAttributeValues={
            ":date": target_date,
            ":not_tag": "Amazon"
        }
    )

    # Also get non-Amazon services (AWS*, etc.)
    response2 = raw_table.scan(
        FilterExpression="#d = :date AND attribute_exists(#src) AND #src = :svc_src",
        ExpressionAttributeNames={"#d": "date", "#src": "source"},
        ExpressionAttributeValues={
            ":date": target_date,
            ":svc_src": "service_dimension"
        }
    )

    # Merge — use source=service_dimension as the reliable filter
    service_costs = {}
    for item in response2.get("Items", []):
        pk = item["service_account"]
        # Extract service name: "AmazonEC2#123456789012" → "AmazonEC2"
        service = pk.split("#")[0]
        cost = float(item["cost_usd"])
        service_costs[service] = service_costs.get(service, 0.0) + cost

    return service_costs


def fetch_history_for_service(service: str, days: int = 30) -> list[float]:
    """
    Query cost_aggregated GSI (service-date-index) for the last N days
    of a given service. Returns a list of total_cost floats, oldest first.
    """
    agg_table = get_agg_table()
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        response = agg_table.query(
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

    return [float(item["total_cost"]) for item in response.get("Items", [])]


def compute_baselines(history: list[float]) -> dict:
    """Compute baseline statistics from historical costs."""
    result = {
        "baseline_30d_avg": None,
        "baseline_30d_std": None,
        "baseline_7d_avg": None,
        "history_days_available": len(history)
    }

    if len(history) >= 2:
        result["baseline_30d_avg"] = round(statistics.mean(history), 4)
        try:
            result["baseline_30d_std"] = round(statistics.stdev(history), 4)
        except statistics.StatisticsError:
            pass

    if len(history) >= 7:
        result["baseline_7d_avg"] = round(statistics.mean(history[-7:]), 4)

    return result


def lambda_handler(event, context):
    """
    Aggregator Lambda — reads raw cost records, computes baselines,
    writes enriched records to cost_aggregated.
    """
    target_date = get_target_date()
    logger.info(f"Aggregating costs for {target_date}")

    # Step 1: Get today's raw costs grouped by service
    service_costs = fetch_raw_records_for_date(target_date)
    logger.info(f"Found {len(service_costs)} services with cost data")

    if not service_costs:
        logger.info("No raw records found for target date — nothing to aggregate")
        return {
            "statusCode": 200,
            "target_date": target_date,
            "services_processed": 0
        }

    ttl = build_ttl()
    agg_table = get_agg_table()
    services_processed = 0

    with agg_table.batch_writer() as batch:
        for service, cost in service_costs.items():
            # Step 2: Get historical data for baseline computation
            history = fetch_history_for_service(service, days=30)

            # Step 3: Compute baseline statistics
            baselines = compute_baselines(history)

            # Step 4: Write enriched record to cost_aggregated
            batch.put_item(Item={
                "date":                  target_date,
                "service":               service,
                "total_cost":            Decimal(str(round(cost, 4))),
                "baseline_30d_avg":      Decimal(str(baselines["baseline_30d_avg"])) if baselines["baseline_30d_avg"] is not None else Decimal("0"),
                "baseline_30d_std":      Decimal(str(baselines["baseline_30d_std"])) if baselines["baseline_30d_std"] is not None else Decimal("0"),
                "baseline_7d_avg":       Decimal(str(baselines["baseline_7d_avg"])) if baselines["baseline_7d_avg"] is not None else Decimal("0"),
                "history_days_available": baselines["history_days_available"],
                "z_score":               Decimal("0"),
                "pct_change_7d":         Decimal("0"),
                "is_anomaly":            False,
                "anomaly_reason":        "none",
                "ttl":                   ttl
            })
            services_processed += 1

    logger.info(f"Aggregation complete: {services_processed} services processed")

    return {
        "statusCode": 200,
        "target_date": target_date,
        "services_processed": services_processed
    }
