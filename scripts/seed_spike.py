#!/usr/bin/env python3
# scripts/seed_spike.py
#
# Writes a single cost-spike record into cost_aggregated for today's date.
# The record has is_anomaly=False — the anomaly-detector Lambda is what
# should flip it. If you seed it as True you're not testing the pipeline.
#
# Corresponds to: finops-implementation-plan-team.md Phase A4 operational tooling.
# Run after `scripts/seed_test_data.py` and before `scripts/invoke_pipeline.sh`.
#
# Usage:
#   python scripts/seed_spike.py
#   python scripts/seed_spike.py --service AmazonRDS --cost 600 --baseline 80

import os
import sys
import argparse
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# ── Configuration from environment ──────────────────────────
AWS_REGION     = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
AGG_TABLE      = os.environ.get("DYNAMODB_AGG_TABLE", "cost_aggregated")
RETENTION_DAYS = int(os.environ.get("DATA_RETENTION_DAYS", "90"))


def d(value: float) -> Decimal:
    """Convert a float to a DynamoDB-safe Decimal."""
    return Decimal(str(round(value, 4)))


def main():
    parser = argparse.ArgumentParser(
        description="Seed a single cost-spike record into cost_aggregated for "
                    "today. Use before running the anomaly-detector Lambda to "
                    "verify it correctly flags the spike."
    )
    parser.add_argument(
        "--table", default=AGG_TABLE,
        help=f"DynamoDB table name (default: {AGG_TABLE})"
    )
    parser.add_argument(
        "--service", default="AmazonEC2",
        help="Service name to spike (default: AmazonEC2)"
    )
    parser.add_argument(
        "--cost", type=float, default=480.0,
        help="Today's spiked cost in USD (default: 480.0)"
    )
    parser.add_argument(
        "--baseline", type=float, default=120.0,
        help="Expected baseline average for reference (default: 120.0)"
    )
    args = parser.parse_args()

    table_name = args.table
    service = args.service
    cost = args.cost
    baseline = args.baseline

    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    ttl = int((now + timedelta(days=RETENTION_DAYS)).timestamp())

    item = {
        "date":                   today,
        "service":                service,
        "total_cost":             d(cost),
        "baseline_30d_avg":       d(baseline),
        "baseline_30d_std":       d(baseline * 0.05),
        "baseline_7d_avg":        d(baseline),
        "z_score":                d(0),
        "pct_change_7d":          d(0),
        "is_anomaly":             False,
        "anomaly_reason":         "none",
        "skip_reason":            "",
        "history_days_available":  31,
        "ttl":                    ttl,
    }

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(table_name)

    try:
        table.put_item(Item=item)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "ResourceNotFoundException":
            print(f"❌ Table '{table_name}' does not exist.", file=sys.stderr)
            print(f"   Run `terraform output` to check the actual table name.", file=sys.stderr)
            sys.exit(1)
        raise

    pct = ((cost - baseline) / baseline) * 100

    print(f"✅ Spike seeded into '{table_name}'")
    print(f"   Date:     {today}")
    print(f"   Service:  {service}")
    print(f"   Cost:     ${cost:,.2f}  (baseline ${baseline:,.2f}, +{pct:.0f}%)")
    print(f"   is_anomaly = False  ← detector Lambda should flip this to True")
    print()
    print("Verify with:")
    print(f'  aws dynamodb get-item \\')
    print(f'    --table-name {table_name} \\')
    print(f'    --key \'{{"date": {{"S": "{today}"}}, "service": {{"S": "{service}"}}}}\'')


if __name__ == "__main__":
    main()
