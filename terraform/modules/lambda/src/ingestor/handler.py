import os
import boto3
import logging
from datetime import datetime, timedelta
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION         = os.environ.get("AWS_REGION", "ap-south-1")
RAW_TABLE      = os.environ.get("DYNAMODB_RAW_TABLE", "cost_raw")
ACCOUNT_ID     = os.environ.get("ACCOUNT_ID", "")
LOOKBACK_DAYS  = int(os.environ.get("COST_LOOKBACK_DAYS", "2"))
RETENTION_DAYS = int(os.environ.get("DATA_RETENTION_DAYS", "90"))

# Lazy globals — initialized on first call, not at import time
# This is the correct Lambda pattern: reused across warm invocations,
# but never initialized during import (which breaks moto mocking)
_ce_client = None
_table     = None


def get_ce_client():
    global _ce_client
    if _ce_client is None:
        _ce_client = boto3.client("ce", region_name="us-east-1")
    return _ce_client


def get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        _table   = dynamodb.Table(RAW_TABLE)
    return _table


def get_target_date() -> tuple[str, str]:
    """Returns (target_date, next_date) as ISO strings for CE API call."""
    target = datetime.utcnow() - timedelta(days=LOOKBACK_DAYS)
    return (
        target.strftime("%Y-%m-%d"),
        (target + timedelta(days=1)).strftime("%Y-%m-%d")
    )


def fetch_costs_by_service(start: str, end: str) -> list[dict]:
    """Single CE API call grouped by SERVICE. CE costs $0.01/call — max 2 per run."""
    response = get_ce_client().get_cost_and_usage(
        TimePeriod={"Start": start, "End": end},
        Granularity="DAILY",
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        Metrics=["UnblendedCost"]
    )
    return response["ResultsByTime"][0]["Groups"]


def fetch_costs_by_tag(start: str, end: str) -> list[dict]:
    """Second CE API call grouped by team tag. Non-fatal if tag not yet active."""
    try:
        response = get_ce_client().get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="DAILY",
            GroupBy=[{"Type": "TAG", "Key": "team"}],
            Metrics=["UnblendedCost"]
        )
        return response["ResultsByTime"][0]["Groups"]
    except Exception as e:
        logger.warning(f"Tag-based cost fetch failed (tag may not be active yet): {e}")
        return []


def build_ttl() -> int:
    return int((datetime.utcnow() + timedelta(days=RETENTION_DAYS)).timestamp())


def lambda_handler(event, context):
    target_date, next_date = get_target_date()
    logger.info(f"Fetching costs for {target_date} (T-{LOOKBACK_DAYS})")

    service_groups = fetch_costs_by_service(target_date, next_date)
    logger.info(f"Retrieved {len(service_groups)} service groups")

    tag_groups = fetch_costs_by_tag(target_date, next_date)
    logger.info(f"Retrieved {len(tag_groups)} tag groups")

    ttl     = build_ttl()
    written = 0
    skipped = 0

    with get_table().batch_writer() as batch:
        for group in service_groups:
            service = group["Keys"][0]
            cost    = float(group["Metrics"]["UnblendedCost"]["Amount"])

            if cost == 0.0:
                skipped += 1
                continue

            batch.put_item(Item={
                "service_account": f"{service}#{ACCOUNT_ID}",
                "date":            target_date,
                "cost_usd":        Decimal(str(round(cost, 6))),
                "source":          "service_dimension",
                "ttl":             ttl
            })
            written += 1

        for group in tag_groups:
            tag_value = group["Keys"][0] if group["Keys"] else "untagged"
            cost      = float(group["Metrics"]["UnblendedCost"]["Amount"])

            if cost == 0.0:
                continue

            batch.put_item(Item={
                "service_account": f"tag:team:{tag_value}#{ACCOUNT_ID}",
                "date":            target_date,
                "cost_usd":        Decimal(str(round(cost, 6))),
                "source":          "tag_dimension",
                "ttl":             ttl
            })

    logger.info(f"Written: {written}, Skipped: {skipped} zero-cost services")

    return {
        "statusCode":      200,
        "target_date":     target_date,
        "records_written": written,
        "records_skipped": skipped
    }