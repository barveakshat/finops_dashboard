import os
import boto3
import pathlib
import importlib.util
from moto import mock_aws
from datetime import datetime, timedelta
from decimal import Decimal

# Env vars MUST be set before handler loads
os.environ["DYNAMODB_RAW_TABLE"]    = "cost_raw"
os.environ["DYNAMODB_AGG_TABLE"]    = "cost_aggregated"
os.environ["ACCOUNT_ID"]            = "123456789012"
os.environ["DATA_RETENTION_DAYS"]   = "90"
os.environ["AWS_DEFAULT_REGION"]    = "ap-south-1"
os.environ["AWS_ACCESS_KEY_ID"]     = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SECURITY_TOKEN"]    = "testing"
os.environ["AWS_SESSION_TOKEN"]     = "testing"

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.resolve()
HANDLER_PATH = str(PROJECT_ROOT / "terraform/modules/lambda/src/aggregator/handler.py")


def load_handler():
    """Load handler fresh per test to avoid stale globals."""
    spec = importlib.util.spec_from_file_location("aggregator_handler", HANDLER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # Reset lazy globals
    mod._raw_table = None
    mod._agg_table = None
    return mod


def create_raw_table(dynamodb):
    return dynamodb.create_table(
        TableName="cost_raw",
        KeySchema=[
            {"AttributeName": "service_account", "KeyType": "HASH"},
            {"AttributeName": "date",             "KeyType": "RANGE"}
        ],
        AttributeDefinitions=[
            {"AttributeName": "service_account", "AttributeType": "S"},
            {"AttributeName": "date",            "AttributeType": "S"}
        ],
        BillingMode="PAY_PER_REQUEST"
    )


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


def seed_raw_data(raw_table, target_date):
    """Seed cost_raw with test records for the target date."""
    with raw_table.batch_writer() as batch:
        batch.put_item(Item={
            "service_account": "AmazonEC2#123456789012",
            "date": target_date,
            "cost_usd": Decimal("142.56"),
            "source": "service_dimension",
            "ttl": 9999999999
        })
        batch.put_item(Item={
            "service_account": "AmazonRDS#123456789012",
            "date": target_date,
            "cost_usd": Decimal("80.00"),
            "source": "service_dimension",
            "ttl": 9999999999
        })


def seed_history(agg_table, service, days=30, base_cost=100.0):
    """Seed cost_aggregated with historical records for baseline computation."""
    with agg_table.batch_writer() as batch:
        for i in range(days, 0, -1):
            date = (datetime.utcnow() - timedelta(days=i + 2)).strftime("%Y-%m-%d")
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


@mock_aws
def test_aggregator_writes_enriched_records():
    """Aggregator should write one record per service to cost_aggregated."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    raw_table = create_raw_table(dynamodb)
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    target_date = handler.get_target_date()
    seed_raw_data(raw_table, target_date)

    handler._raw_table = raw_table
    handler._agg_table = agg_table

    result = handler.lambda_handler({}, {})

    assert result["statusCode"] == 200
    assert result["services_processed"] == 2

    # Verify records in cost_aggregated
    items = agg_table.scan()["Items"]
    assert len(items) == 2
    services = {item["service"] for item in items}
    assert "AmazonEC2" in services
    assert "AmazonRDS" in services


@mock_aws
def test_aggregator_computes_baselines_with_history():
    """With 30 days of historical data, baselines should be populated."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    raw_table = create_raw_table(dynamodb)
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    target_date = handler.get_target_date()

    # Seed raw data and historical aggregated data
    with raw_table.batch_writer() as batch:
        batch.put_item(Item={
            "service_account": "AmazonEC2#123456789012",
            "date": target_date,
            "cost_usd": Decimal("150.00"),
            "source": "service_dimension",
            "ttl": 9999999999
        })
    seed_history(agg_table, "AmazonEC2", days=30, base_cost=100.0)

    handler._raw_table = raw_table
    handler._agg_table = agg_table

    result = handler.lambda_handler({}, {})
    assert result["services_processed"] == 1

    # Verify the new record has baselines
    response = agg_table.query(
        KeyConditionExpression="#d = :date",
        ExpressionAttributeNames={"#d": "date"},
        ExpressionAttributeValues={":date": target_date}
    )
    items = response["Items"]
    assert len(items) == 1

    item = items[0]
    assert item["service"] == "AmazonEC2"
    assert float(item["total_cost"]) == 150.0
    assert float(item["baseline_30d_avg"]) > 0
    assert item["history_days_available"] > 0


@mock_aws
def test_aggregator_empty_raw_table():
    """No raw records → no aggregated records written."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    create_raw_table(dynamodb)
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    handler._raw_table = dynamodb.Table("cost_raw")
    handler._agg_table = agg_table

    result = handler.lambda_handler({}, {})

    assert result["statusCode"] == 200
    assert result["services_processed"] == 0


@mock_aws
def test_aggregator_sets_ttl():
    """Every aggregated record must have a TTL set for auto-expiry."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    raw_table = create_raw_table(dynamodb)
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    target_date = handler.get_target_date()
    seed_raw_data(raw_table, target_date)

    handler._raw_table = raw_table
    handler._agg_table = agg_table

    handler.lambda_handler({}, {})

    items = agg_table.scan()["Items"]
    for item in items:
        assert "ttl" in item
        expected_min = int((datetime.utcnow() + timedelta(days=89)).timestamp())
        assert int(item["ttl"]) >= expected_min


@mock_aws
def test_aggregator_record_has_required_fields():
    """Each aggregated record must have all fields the anomaly detector expects."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    raw_table = create_raw_table(dynamodb)
    agg_table = create_agg_table(dynamodb)

    handler = load_handler()
    target_date = handler.get_target_date()
    seed_raw_data(raw_table, target_date)

    handler._raw_table = raw_table
    handler._agg_table = agg_table

    handler.lambda_handler({}, {})

    items = agg_table.scan()["Items"]
    required_fields = [
        "date", "service", "total_cost", "baseline_30d_avg",
        "baseline_30d_std", "baseline_7d_avg", "z_score",
        "pct_change_7d", "is_anomaly", "anomaly_reason", "ttl"
    ]
    for item in items:
        for field in required_fields:
            assert field in item, f"Missing field '{field}' in aggregated record"
