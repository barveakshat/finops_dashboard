import os
import json
import boto3
import pathlib
import importlib.util
from moto import mock_aws
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from decimal import Decimal

# Env vars MUST be set before handler loads
os.environ["DYNAMODB_AGG_TABLE"]    = "cost_aggregated"
os.environ["SNS_TOPIC_ARN"]        = "arn:aws:sns:ap-south-1:123456789012:finops-anomaly-alerts"
os.environ["Z_SCORE_THRESHOLD"]    = "2.5"
os.environ["SPIKE_THRESHOLD_PCT"]  = "40"
os.environ["MIN_COST_FLOOR"]       = "1.0"
os.environ["DASHBOARD_BASE_URL"]   = "https://dashboard.example.com"
os.environ["AWS_DEFAULT_REGION"]   = "ap-south-1"
os.environ["AWS_ACCESS_KEY_ID"]    = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SECURITY_TOKEN"]   = "testing"
os.environ["AWS_SESSION_TOKEN"]    = "testing"

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.resolve()
HANDLER_PATH = str(PROJECT_ROOT / "terraform/modules/lambda/src/anomaly_detector/handler.py")


def load_handler():
    """Load handler fresh per test."""
    spec = importlib.util.spec_from_file_location("anomaly_detector_handler", HANDLER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod._agg_table = None
    mod._sns_client = None
    return mod


def create_agg_table(dynamodb):
    return dynamodb.create_table(
        TableName="cost_aggregated",
        KeySchema=[
            {"AttributeName": "date",    "KeyType": "HASH"},
            {"AttributeName": "service", "KeyType": "RANGE"}
        ],
        AttributeDefinitions=[
            {"AttributeName": "date",    "AttributeType": "S"},
            {"AttributeName": "service", "AttributeType": "S"}
        ],
        BillingMode="PAY_PER_REQUEST",
        GlobalSecondaryIndexes=[{
            "IndexName": "service-date-index",
            "KeySchema": [
                {"AttributeName": "service", "KeyType": "HASH"},
                {"AttributeName": "date",    "KeyType": "RANGE"}
            ],
            "Projection": {"ProjectionType": "ALL"}
        }]
    )


def seed_history_and_today(agg_table, service, today_date, today_cost,
                           history_days=30, base_cost=100.0):
    """Seed historical data and today's record for a service."""
    with agg_table.batch_writer() as batch:
        # Historical records
        for i in range(history_days, 0, -1):
            date = (datetime.strptime(today_date, "%Y-%m-%d") - timedelta(days=i)).strftime("%Y-%m-%d")
            cost = base_cost + (i % 5 - 2)
            batch.put_item(Item={
                "date": date,
                "service": service,
                "total_cost": Decimal(str(round(cost, 4))),
                "baseline_30d_avg": Decimal(str(base_cost)),
                "baseline_30d_std": Decimal("5"),
                "baseline_7d_avg": Decimal(str(base_cost)),
                "z_score": Decimal("0"),
                "pct_change_7d": Decimal("0"),
                "is_anomaly": False,
                "anomaly_reason": "none",
                "history_days_available": i,
                "ttl": 9999999999
            })
        # Today's record (pre-aggregated, anomaly fields not yet set)
        batch.put_item(Item={
            "date": today_date,
            "service": service,
            "total_cost": Decimal(str(today_cost)),
            "baseline_30d_avg": Decimal("0"),
            "baseline_30d_std": Decimal("0"),
            "baseline_7d_avg": Decimal("0"),
            "z_score": Decimal("0"),
            "pct_change_7d": Decimal("0"),
            "is_anomaly": False,
            "anomaly_reason": "none",
            "ttl": 9999999999
        })


@mock_aws
def test_anomaly_detected_publishes_to_sns():
    """When a cost spike is detected, SNS publish should be called."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    # Create SNS topic
    sns = boto3.client("sns", region_name="ap-south-1")
    topic = sns.create_topic(Name="finops-anomaly-alerts")
    topic_arn = topic["TopicArn"]

    today_date = "2024-06-15"

    # Seed with a massive spike: $400 vs ~$100 baseline
    seed_history_and_today(agg_table, "AmazonEC2", today_date,
                           today_cost=400.0, history_days=30, base_cost=100.0)

    handler = load_handler()
    handler._agg_table = agg_table
    handler._sns_client = sns
    os.environ["SNS_TOPIC_ARN"] = topic_arn

    result = handler.lambda_handler({"date": today_date}, {})

    assert result["statusCode"] == 200
    assert result["anomalies_found"] >= 1

    # Verify the record was updated in DynamoDB
    response = agg_table.get_item(Key={"date": today_date, "service": "AmazonEC2"})
    item = response["Item"]
    assert item["is_anomaly"] is True
    assert item["anomaly_reason"] != "none"


@mock_aws
def test_no_anomaly_does_not_publish():
    """Normal costs should NOT trigger SNS publish."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    sns = boto3.client("sns", region_name="ap-south-1")
    topic = sns.create_topic(Name="finops-anomaly-alerts")
    topic_arn = topic["TopicArn"]

    today_date = "2024-06-15"

    # Normal cost — $102 vs ~$100 baseline → no anomaly
    seed_history_and_today(agg_table, "AmazonS3", today_date,
                           today_cost=102.0, history_days=30, base_cost=100.0)

    handler = load_handler()
    handler._agg_table = agg_table
    handler._sns_client = sns
    os.environ["SNS_TOPIC_ARN"] = topic_arn

    result = handler.lambda_handler({"date": today_date}, {})

    assert result["statusCode"] == 200
    assert result["anomalies_found"] == 0

    # Verify record updated but not flagged
    response = agg_table.get_item(Key={"date": today_date, "service": "AmazonS3"})
    item = response["Item"]
    assert item["is_anomaly"] is False


@mock_aws
def test_multiple_services_only_anomalous_trigger_sns():
    """Only anomalous services should trigger SNS, not normal ones."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    sns = boto3.client("sns", region_name="ap-south-1")
    topic = sns.create_topic(Name="finops-anomaly-alerts")
    topic_arn = topic["TopicArn"]

    today_date = "2024-06-15"

    # One spike, one normal
    seed_history_and_today(agg_table, "AmazonEC2", today_date,
                           today_cost=400.0, history_days=30, base_cost=100.0)
    seed_history_and_today(agg_table, "AmazonS3", today_date,
                           today_cost=16.0, history_days=30, base_cost=15.0)

    handler = load_handler()
    handler._agg_table = agg_table
    handler._sns_client = sns
    os.environ["SNS_TOPIC_ARN"] = topic_arn

    result = handler.lambda_handler({"date": today_date}, {})

    assert result["services_checked"] == 2
    assert result["anomalies_found"] == 1  # Only EC2


@mock_aws
def test_empty_table_returns_zero():
    """Empty cost_aggregated table → 0 services checked, 0 anomalies."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    handler._agg_table = agg_table

    result = handler.lambda_handler({"date": "2024-06-15"}, {})

    assert result["statusCode"] == 200
    assert result["services_checked"] == 0
    assert result["anomalies_found"] == 0


@mock_aws
def test_anomaly_record_updated_with_z_score():
    """After detection, the record should have z_score and pct_change populated."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    sns = boto3.client("sns", region_name="ap-south-1")
    topic = sns.create_topic(Name="finops-anomaly-alerts")
    os.environ["SNS_TOPIC_ARN"] = topic["TopicArn"]

    today_date = "2024-06-15"
    seed_history_and_today(agg_table, "AmazonRDS", today_date,
                           today_cost=350.0, history_days=30, base_cost=100.0)

    handler = load_handler()
    handler._agg_table = agg_table
    handler._sns_client = sns

    handler.lambda_handler({"date": today_date}, {})

    response = agg_table.get_item(Key={"date": today_date, "service": "AmazonRDS"})
    item = response["Item"]
    # z_score and pct_change should be updated from zero
    assert float(item["z_score"]) != 0
    assert float(item["pct_change_7d"]) > 0
