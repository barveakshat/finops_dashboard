import os
import json
import boto3
import pathlib
import importlib.util
from moto import mock_aws
from datetime import datetime, timedelta
from decimal import Decimal

# Env vars MUST be set before handler loads
os.environ["DYNAMODB_AGG_TABLE"]    = "cost_aggregated"
os.environ["MONTHLY_BUDGET_USD"]    = "500.00"
os.environ["AWS_DEFAULT_REGION"]    = "ap-south-1"
os.environ["AWS_ACCESS_KEY_ID"]     = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SECURITY_TOKEN"]    = "testing"
os.environ["AWS_SESSION_TOKEN"]     = "testing"

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.resolve()
HANDLER_PATH = str(PROJECT_ROOT / "terraform/modules/lambda/src/api_handler/handler.py")


def load_handler():
    """Load handler fresh per test."""
    spec = importlib.util.spec_from_file_location("api_handler_handler", HANDLER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod._agg_table = None
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


def seed_agg_data(agg_table, days=7):
    """Seed cost_aggregated with test data for the last N days."""
    services = [
        ("AmazonEC2", 142.56, True, "Z-score: 3.57 exceeds threshold 2.5"),
        ("AmazonRDS", 80.00, False, "none"),
        ("AmazonS3", 18.20, False, "none"),
    ]
    for day_offset in range(days, 0, -1):
        date = (datetime.utcnow() - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        for name, base_cost, is_anom, reason in services:
            cost = base_cost + (day_offset % 3 - 1)
            agg_table.put_item(Item={
                "date": date,
                "service": name,
                "total_cost": Decimal(str(round(cost, 2))),
                "baseline_30d_avg": Decimal(str(round(base_cost, 2))),
                "baseline_30d_std": Decimal("10"),
                "baseline_7d_avg": Decimal(str(round(base_cost, 2))),
                "z_score": Decimal("3.57") if is_anom else Decimal("0.5"),
                "pct_change_7d": Decimal("61.2") if is_anom else Decimal("2.0"),
                "is_anomaly": is_anom and day_offset == 1,  # Only today's EC2 is anomaly
                "anomaly_reason": reason if is_anom and day_offset == 1 else "none",
                "history_days_available": 30,
                "ttl": 9999999999
            })


def make_api_event(path, query_params=None, path_params=None):
    """Build a minimal API Gateway event."""
    return {
        "httpMethod": "GET",
        "path": path,
        "queryStringParameters": query_params or {},
        "pathParameters": path_params or {}
    }


@mock_aws
def test_get_costs_returns_correct_structure():
    """GET /costs should return period, total_cost_usd, and records array."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)
    seed_agg_data(agg_table, days=7)

    handler = load_handler()
    handler._agg_table = agg_table

    event = make_api_event("/costs", query_params={"period": "7d"})
    result = handler.lambda_handler(event, {})

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert "period" in body
    assert "total_cost_usd" in body
    assert "records" in body
    assert isinstance(body["records"], list)
    assert len(body["records"]) > 0


@mock_aws
def test_get_costs_has_correct_field_types():
    """Records should have is_anomaly as boolean, not string."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)
    seed_agg_data(agg_table, days=3)

    handler = load_handler()
    handler._agg_table = agg_table

    event = make_api_event("/costs", query_params={"period": "3d"})
    result = handler.lambda_handler(event, {})
    body = json.loads(result["body"])

    for record in body["records"]:
        assert isinstance(record["is_anomaly"], bool), \
            f"is_anomaly should be bool, got {type(record['is_anomaly'])}"
        assert isinstance(record["total_usd"], (int, float)), \
            f"total_usd should be numeric, got {type(record['total_usd'])}"


@mock_aws
def test_get_service_trend():
    """GET /costs/{service} should return trend data for a single service."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)
    seed_agg_data(agg_table, days=7)

    handler = load_handler()
    handler._agg_table = agg_table

    event = make_api_event(
        "/costs/AmazonEC2",
        query_params={"period": "7d"},
        path_params={"service": "AmazonEC2"}
    )
    result = handler.lambda_handler(event, {})

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["service"] == "AmazonEC2"
    assert "trend" in body
    assert isinstance(body["trend"], list)
    assert len(body["trend"]) > 0

    # Each trend point should have the right fields
    for point in body["trend"]:
        assert "date" in point
        assert "total_usd" in point
        assert "is_anomaly" in point


@mock_aws
def test_get_anomalies_filters_correctly():
    """GET /anomalies should only return records where is_anomaly is True."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)
    seed_agg_data(agg_table, days=7)

    handler = load_handler()
    handler._agg_table = agg_table

    event = make_api_event("/anomalies", query_params={"period": "7d"})
    result = handler.lambda_handler(event, {})

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert "anomalies" in body
    assert isinstance(body["anomalies"], list)

    # All returned records should be anomalies
    for anom in body["anomalies"]:
        assert "service" in anom
        assert "cost_today" in anom
        assert "anomaly_reason" in anom


@mock_aws
def test_get_budget():
    """GET /budget/{month} should return budget breakdown."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    # Seed data for a specific month
    for day in range(1, 16):
        date = f"2024-01-{day:02d}"
        agg_table.put_item(Item={
            "date": date,
            "service": "AmazonEC2",
            "total_cost": Decimal("20.00"),
            "baseline_30d_avg": Decimal("20"),
            "baseline_30d_std": Decimal("2"),
            "baseline_7d_avg": Decimal("20"),
            "z_score": Decimal("0"),
            "pct_change_7d": Decimal("0"),
            "is_anomaly": False,
            "anomaly_reason": "none",
            "ttl": 9999999999
        })

    handler = load_handler()
    handler._agg_table = agg_table

    event = make_api_event(
        "/budget/2024-01",
        path_params={"month": "2024-01"}
    )
    result = handler.lambda_handler(event, {})

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["month"] == "2024-01"
    assert "budget_usd" in body
    assert "spent_usd" in body
    assert "pct_used" in body
    assert "days_remaining" in body
    assert "projected_total" in body
    assert body["budget_usd"] == 500.0


@mock_aws
def test_unknown_route_returns_404():
    """Unknown route should return 404 with error message."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    create_agg_table(dynamodb)

    handler = load_handler()
    handler._agg_table = dynamodb.Table("cost_aggregated")

    event = make_api_event("/unknown/path")
    result = handler.lambda_handler(event, {})

    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert "error" in body


@mock_aws
def test_cors_headers_present():
    """Every response should include CORS headers."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    handler._agg_table = agg_table

    event = make_api_event("/costs", query_params={"period": "7d"})
    result = handler.lambda_handler(event, {})

    assert "headers" in result
    assert result["headers"]["Access-Control-Allow-Origin"] == "*"
    assert result["headers"]["Content-Type"] == "application/json"


@mock_aws
def test_empty_table_returns_empty_records():
    """With no data, /costs should return empty records array, not an error."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    handler._agg_table = agg_table

    event = make_api_event("/costs", query_params={"period": "7d"})
    result = handler.lambda_handler(event, {})

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["records"] == []
    assert body["total_cost_usd"] == 0
