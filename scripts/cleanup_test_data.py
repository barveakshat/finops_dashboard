#!/usr/bin/env python3
# scripts/cleanup_test_data.py
#
# Deletes all seeded test data from cost_raw and cost_aggregated.
# This is NOT `terraform destroy` — it clears data between test runs
# while keeping the tables and infra alive.
#
# Corresponds to: finops-implementation-plan-team.md Phase A4 operational tooling.
# Run between test iterations to start fresh.
#
# Usage:
#   python scripts/cleanup_test_data.py            # dry run — shows counts
#   python scripts/cleanup_test_data.py --confirm   # actually deletes

import os
import sys
import argparse

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# ── Configuration from environment ──────────────────────────
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
RAW_TABLE  = os.environ.get("DYNAMODB_RAW_TABLE", "cost_raw")
AGG_TABLE  = os.environ.get("DYNAMODB_AGG_TABLE", "cost_aggregated")

# Key schemas — must match terraform/modules/dynamodb/main.tf
TABLE_KEYS = {
    RAW_TABLE: ("service_account", "date"),  # PK, SK
    AGG_TABLE: ("date", "service"),           # PK, SK
}


def count_items(table) -> int:
    """Scan the table and return total item count."""
    count = 0
    response = table.scan(Select="COUNT")
    count += response["Count"]
    while response.get("LastEvaluatedKey"):
        response = table.scan(
            Select="COUNT",
            ExclusiveStartKey=response["LastEvaluatedKey"]
        )
        count += response["Count"]
    return count


def delete_all_items(table, pk_name: str, sk_name: str) -> int:
    """Scan and batch-delete all items from a table. Returns count deleted."""
    deleted = 0

    # Scan only the key attributes — no need to fetch full items
    scan_kwargs = {
        "ProjectionExpression": f"#pk, #sk",
        "ExpressionAttributeNames": {"#pk": pk_name, "#sk": sk_name},
    }

    while True:
        response = table.scan(**scan_kwargs)
        items = response.get("Items", [])

        if not items:
            break

        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={
                    pk_name: item[pk_name],
                    sk_name: item[sk_name],
                })
                deleted += 1

        if not response.get("LastEvaluatedKey"):
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return deleted


def main():
    parser = argparse.ArgumentParser(
        description="Delete all test data from cost_raw and cost_aggregated. "
                    "Requires --confirm to actually delete; without it, shows "
                    "a dry-run count."
    )
    parser.add_argument(
        "--confirm", action="store_true",
        help="Actually delete the data. Without this flag, only counts are shown."
    )
    args = parser.parse_args()

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)

    tables = {}
    for table_name, (pk, sk) in TABLE_KEYS.items():
        try:
            table = dynamodb.Table(table_name)
            item_count = count_items(table)
            tables[table_name] = (table, pk, sk, item_count)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "ResourceNotFoundException":
                print(f"⚠️  Table '{table_name}' does not exist — skipping")
                continue
            raise

    if not tables:
        print("No tables found. Nothing to do.")
        return

    # ── Dry run ─────────────────────────────────────────────
    if not args.confirm:
        print("DRY RUN — no data will be deleted. Pass --confirm to delete.\n")
        for table_name, (_, _, _, item_count) in tables.items():
            print(f"  {table_name}: {item_count} items would be deleted")
        print()
        total = sum(c for _, _, _, c in tables.values())
        print(f"Total: {total} items across {len(tables)} tables")
        return

    # ── Confirmed deletion ──────────────────────────────────
    print(f"Deleting all data from {len(tables)} tables in {AWS_REGION}...\n")

    total_deleted = 0
    for table_name, (table, pk, sk, item_count) in tables.items():
        if item_count == 0:
            print(f"  {table_name}: 0 items — nothing to delete")
            continue

        print(f"  {table_name}: deleting {item_count} items...", end=" ", flush=True)
        deleted = delete_all_items(table, pk, sk)
        print(f"✅ {deleted} deleted")
        total_deleted += deleted

    print(f"\n✅ Done — {total_deleted} total items deleted")


if __name__ == "__main__":
    main()
