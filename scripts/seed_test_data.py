#!/usr/bin/env python3
# scripts/seed_test_data.py
#
# Writes 31 days of realistic historical cost data into cost_aggregated
# for 6 services so Person B has consistent chart shapes to build against.
#
# Corresponds to: finops-implementation-plan-team.md Phase A4 operational tooling.
# Run after `terraform apply` and before `scripts/invoke_pipeline.sh`.
#
# Usage:
#   python scripts/seed_test_data.py
#   python scripts/seed_test_data.py --days 14 --table cost_aggregated

import os
import sys
import argparse
import random
import statistics
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# ── Configuration from environment ──────────────────────────
AWS_REGION       = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
AGG_TABLE        = os.environ.get("DYNAMODB_AGG_TABLE", "cost_aggregated")
RETENTION_DAYS   = int(os.environ.get("DATA_RETENTION_DAYS", "90"))

# ── Service definitions ─────────────────────────────────────
# (service_name, base_daily_usd, variance_fraction)
SERVICES = [
    ("AmazonEC2",        120.0, 0.05),
    ("AmazonRDS",         80.0, 0.08),
    ("AmazonS3",          15.0, 0.15),
    ("AWSLambda",          3.0, 0.20),
    ("AmazonCloudFront",   8.0, 0.10),
    ("AWSDataTransfer",   12.0, 0.12),
]


def d(value: float) -> Decimal:
    """Convert a float to a DynamoDB-safe Decimal."""
    return Decimal(str(round(value, 4)))


def build_records(days: int) -> list[dict]:
    """Generate `days` days of records for all services.

    Uses random.seed(42) for reproducible results.
    Records go from T-{days} to T-1 (yesterday).
    """
    random.seed(42)
    now = datetime.now(timezone.utc)
    ttl = int((now + timedelta(days=RETENTION_DAYS)).timestamp())
    records = []

    for day_offset in range(days, 0, -1):
        date_str = (now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        # history_days_available decreases as we go further back
        # Day 1 (oldest) has 1 day of history, day `days` (yesterday) has `days`
        history_available = days - day_offset + 1

        for service, base, variance in SERVICES:
            noise = random.gauss(0, base * variance)
            cost = max(0.01, base + noise)  # never negative

            records.append({
                "date":                   date_str,
                "service":                service,
                "total_cost":             d(cost),
                "baseline_30d_avg":       d(base),
                "baseline_30d_std":       d(base * variance),
                "baseline_7d_avg":        d(base),
                "z_score":                d(0),
                "pct_change_7d":          d(0),
                "is_anomaly":             False,
                "anomaly_reason":         "none",
                "skip_reason":            "" if history_available >= 7 else "insufficient_data",
                "history_days_available":  history_available,
                "ttl":                    ttl,
            })

    return records


def main():
    parser = argparse.ArgumentParser(
        description="Seed cost_aggregated with 31 days of realistic test data "
                    "for 6 AWS services. Run after terraform apply."
    )
    parser.add_argument(
        "--table", default=AGG_TABLE,
        help=f"DynamoDB table name (default: {AGG_TABLE})"
    )
    parser.add_argument(
        "--days", type=int, default=31,
        help="Number of days of history to generate (default: 31)"
    )
    args = parser.parse_args()

    table_name = args.table
    days = args.days

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(table_name)

    records = build_records(days)

    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"Seeding {len(records)} records into '{table_name}' in {AWS_REGION}")
    print(f"  Date range: {start_date} → {end_date}")
    print(f"  Services:   {', '.join(s[0] for s in SERVICES)}")
    print()

    try:
        written = 0
        with table.batch_writer() as batch:
            for record in records:
                batch.put_item(Item=record)
                written += 1

        print(f"✅ Done — {written} records written to '{table_name}'")
        print(f"   {days} days × {len(SERVICES)} services = {days * len(SERVICES)} expected")

    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "ResourceNotFoundException":
            print(f"❌ Table '{table_name}' does not exist.", file=sys.stderr)
            print(f"   Run `terraform output` to check the actual table name.", file=sys.stderr)
            sys.exit(1)
        raise


if __name__ == "__main__":
    main()
