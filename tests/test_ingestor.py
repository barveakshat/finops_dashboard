import os
import boto3
import pathlib
import importlib.util
from moto import mock_aws
from unittest.mock import MagicMock
from datetime import datetime, timedelta

# Env vars MUST be set before handler loads
os.environ["DYNAMODB_RAW_TABLE"]    = "cost_raw"
os.environ["ACCOUNT_ID"]            = "123456789012"
os.environ["COST_LOOKBACK_DAYS"]    = "2"
os.environ["DATA_RETENTION_DAYS"]   = "90"
os.environ["AWS_DEFAULT_REGION"]    = "ap-south-1"
os.environ["AWS_ACCESS_KEY_ID"]     = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SECURITY_TOKEN"]    = "testing"
os.environ["AWS_SESSION_TOKEN"]     = "testing"

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.resolve()
HANDLER_PATH = str(PROJECT_ROOT / "terraform/modules/lambda/src/ingestor/handler.py")

MOCK_CE_RESPONSE = {
    "ResultsByTime": [{
        "Groups": [
            {"Keys": ["AmazonEC2"], "Metrics": {"UnblendedCost": {"Amount": "142.56", "Unit": "USD"}}},
            {"Keys": ["AmazonRDS"], "Metrics": {"UnblendedCost": {"Amount": "80.00",  "Unit": "USD"}}},
            {"Keys": ["Tax"],       "Metrics": {"UnblendedCost": {"Amount": "0.00",   "Unit": "USD"}}}
        ]
    }]
}


def load_handler():
    """Load handler fresh per test — unique module name avoids cache collisions."""
    spec = importlib.util.spec_from_file_location("ingestor_handler", HANDLER_PATH)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # Reset lazy globals so each test starts clean
    mod._ce_client = None
    mod._table     = None
    return mod


def create_raw_table(dynamodb_resource):
    return dynamodb_resource.create_table(
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


@mock_aws
def test_ingestor_writes_nonzero_services():
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    table    = create_raw_table(dynamodb)

    mock_ce  = MagicMock()
    mock_ce.get_cost_and_usage.return_value = MOCK_CE_RESPONSE

    handler            = load_handler()
    handler._ce_client = mock_ce
    handler._table     = table

    result = handler.lambda_handler({}, {})

    assert result["statusCode"]      == 200
    assert result["records_written"] == 2   # EC2 + RDS
    assert result["records_skipped"] == 1   # Tax ($0)


@mock_aws
def test_ingestor_skips_zero_cost_services():
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    table    = create_raw_table(dynamodb)

    mock_ce  = MagicMock()
    mock_ce.get_cost_and_usage.return_value = {
        "ResultsByTime": [{"Groups": [
            {"Keys": ["AWSSupport"], "Metrics": {"UnblendedCost": {"Amount": "0.00", "Unit": "USD"}}}
        ]}]
    }

    handler            = load_handler()
    handler._ce_client = mock_ce
    handler._table     = table

    result = handler.lambda_handler({}, {})

    assert result["records_written"] == 0
    assert result["records_skipped"] == 1


@mock_aws
def test_ingestor_sets_ttl():
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    table    = create_raw_table(dynamodb)

    mock_ce  = MagicMock()
    mock_ce.get_cost_and_usage.return_value = MOCK_CE_RESPONSE

    handler            = load_handler()
    handler._ce_client = mock_ce
    handler._table     = table

    handler.lambda_handler({}, {})

    items = table.scan()["Items"]
    assert len(items) > 0
    for item in items:
        assert "ttl" in item
        expected_min = int((datetime.utcnow() + timedelta(days=89)).timestamp())
        assert int(item["ttl"]) >= expected_min


def test_ingestor_target_date_is_t_minus_2():
    # Pure function — no AWS needed
    handler = load_handler()
    target, next_d = handler.get_target_date()
    expected = (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d")
    assert target == expected


@mock_aws
def test_ingestor_record_has_correct_pk_format():
    """PK must be service#account_id — aggregator depends on this exact format."""
    dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
    table    = create_raw_table(dynamodb)

    mock_ce  = MagicMock()
    mock_ce.get_cost_and_usage.return_value = {
        "ResultsByTime": [{"Groups": [
            {"Keys": ["AmazonEC2"], "Metrics": {"UnblendedCost": {"Amount": "100.00", "Unit": "USD"}}}
        ]}]
    }

    handler            = load_handler()
    handler._ce_client = mock_ce
    handler._table     = table

    handler.lambda_handler({}, {})

    items = table.scan()["Items"]
    service_items = [i for i in items if i["source"] == "service_dimension"]
    assert len(service_items) == 1
    assert service_items[0]["service_account"] == "AmazonEC2#123456789012"