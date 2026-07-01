import os
import json
import boto3
import pathlib
import importlib.util
from moto import mock_aws
from unittest.mock import patch, MagicMock

# Env vars MUST be set before handler loads
os.environ["SLACK_SECRET_NAME"]    = "finops/slack-webhook-url"
os.environ["DASHBOARD_BASE_URL"]   = "https://dashboard.example.com"
os.environ["AWS_DEFAULT_REGION"]   = "ap-south-1"
os.environ["AWS_ACCESS_KEY_ID"]    = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SECURITY_TOKEN"]   = "testing"
os.environ["AWS_SESSION_TOKEN"]    = "testing"

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.resolve()
HANDLER_PATH = str(PROJECT_ROOT / "terraform/modules/lambda/src/slack_notifier/handler.py")


SAMPLE_SNS_EVENT = {
    "Records": [{
        "Sns": {
            "Subject": "FinOps Alert — AmazonRDS",
            "Message": json.dumps({
                "service": "AmazonRDS",
                "date": "2024-01-15",
                "cost_today": 412.45,
                "baseline_avg": 256.30,
                "baseline_std": 20.0,
                "z_score": 3.57,
                "pct_change_7d": 61.2,
                "anomaly_reason": "Z-score: 3.57 exceeds threshold 2.5",
                "dashboard_link": "https://dashboard.example.com/service/AmazonRDS?date=2024-01-15"
            })
        }
    }]
}


def load_handler():
    """Load handler fresh per test."""
    spec = importlib.util.spec_from_file_location("slack_notifier_handler", HANDLER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod._webhook_url = None
    return mod


@mock_aws
@patch("urllib.request.urlopen")
def test_slack_notifier_posts_block_kit(mock_urlopen):
    """Valid SNS event → Slack webhook called with Block Kit payload."""
    # Set up Secrets Manager with the webhook URL
    sm = boto3.client("secretsmanager", region_name="ap-south-1")
    sm.create_secret(
        Name="finops/slack-webhook-url",
        SecretString="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX"
    )

    # Mock the urlopen response
    mock_response = MagicMock()
    mock_response.getcode.return_value = 200
    mock_urlopen.return_value = mock_response

    handler = load_handler()
    result = handler.lambda_handler(SAMPLE_SNS_EVENT, {})

    assert result["statusCode"] == 200
    assert result["service"] == "AmazonRDS"
    assert result["slack_status"] == 200

    # Verify urlopen was called
    mock_urlopen.assert_called_once()

    # Verify the request contains Block Kit JSON
    call_args = mock_urlopen.call_args[0][0]
    payload = json.loads(call_args.data.decode("utf-8"))
    assert "blocks" in payload
    assert len(payload["blocks"]) >= 3


@mock_aws
@patch("urllib.request.urlopen")
def test_block_kit_contains_correct_data(mock_urlopen):
    """Block Kit message should contain the service name, cost, and reason."""
    sm = boto3.client("secretsmanager", region_name="ap-south-1")
    sm.create_secret(
        Name="finops/slack-webhook-url",
        SecretString="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX"
    )

    mock_response = MagicMock()
    mock_response.getcode.return_value = 200
    mock_urlopen.return_value = mock_response

    handler = load_handler()
    handler.lambda_handler(SAMPLE_SNS_EVENT, {})

    # Parse the sent payload
    call_args = mock_urlopen.call_args[0][0]
    payload = json.loads(call_args.data.decode("utf-8"))
    blocks_text = json.dumps(payload)

    assert "AmazonRDS" in blocks_text
    assert "412.45" in blocks_text
    assert "Z-score" in blocks_text


@mock_aws
def test_missing_webhook_secret_returns_error():
    """If Secrets Manager doesn't have the webhook, should return 500."""
    # Don't create the secret — let it fail
    handler = load_handler()
    result = handler.lambda_handler(SAMPLE_SNS_EVENT, {})

    assert result["statusCode"] == 500
    assert "error" in result


def test_parse_sns_message():
    """parse_sns_message should extract the anomaly data from SNS envelope."""
    handler = load_handler()
    data = handler.parse_sns_message(SAMPLE_SNS_EVENT)

    assert data["service"] == "AmazonRDS"
    assert data["cost_today"] == 412.45
    assert data["z_score"] == 3.57


def test_build_slack_blocks_structure():
    """build_slack_blocks should return a valid Block Kit payload."""
    handler = load_handler()
    data = {
        "service": "AmazonEC2",
        "date": "2024-01-15",
        "cost_today": 480.0,
        "baseline_avg": 120.0,
        "baseline_std": 6.0,
        "z_score": 60.0,
        "pct_change_7d": 300.0,
        "anomaly_reason": "Spike: 300.0% above 7-day average",
        "dashboard_link": "https://dashboard.example.com/service/AmazonEC2?date=2024-01-15"
    }

    payload = handler.build_slack_blocks(data)

    assert "blocks" in payload
    blocks = payload["blocks"]

    # Header block
    assert blocks[0]["type"] == "header"
    assert "AmazonEC2" in blocks[0]["text"]["text"]

    # Section with fields
    assert blocks[1]["type"] == "section"
    assert len(blocks[1]["fields"]) == 4

    # Actions block with button
    assert blocks[3]["type"] == "actions"
    assert blocks[3]["elements"][0]["type"] == "button"


def test_build_slack_blocks_no_baseline():
    """When baseline is None, expected range should show N/A."""
    handler = load_handler()
    data = {
        "service": "NewService",
        "date": "2024-01-15",
        "cost_today": 50.0,
        "baseline_avg": None,
        "baseline_std": None,
        "z_score": None,
        "pct_change_7d": None,
        "anomaly_reason": "Spike detected",
        "dashboard_link": "https://dashboard.example.com/service/NewService"
    }

    payload = handler.build_slack_blocks(data)
    blocks_text = json.dumps(payload)

    assert "N/A" in blocks_text
