import os
import json
import boto3
import logging
from urllib.request import Request, urlopen
from urllib.error import URLError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION       = os.environ.get("AWS_REGION", "ap-south-1")
SECRET_NAME  = os.environ.get("SLACK_SECRET_NAME", "finops/slack-webhook-url")
DASHBOARD_URL = os.environ.get("DASHBOARD_BASE_URL", "https://localhost:3000")

# Lazy global — cached across warm invocations
_webhook_url = None


def get_webhook_url() -> str:
    """Retrieve Slack webhook URL from Secrets Manager. Cached after first call."""
    global _webhook_url
    if _webhook_url is None:
        client = boto3.client("secretsmanager", region_name=REGION)
        secret = client.get_secret_value(SecretId=SECRET_NAME)
        _webhook_url = secret["SecretString"]
    return _webhook_url


def parse_sns_message(event: dict) -> dict:
    """Extract the anomaly data from the SNS event envelope."""
    record = event["Records"][0]["Sns"]
    message = json.loads(record["Message"])
    return message


def build_slack_blocks(data: dict) -> dict:
    """Build a Slack Block Kit message from anomaly data."""
    service = data.get("service", "Unknown")
    date = data.get("date", "Unknown")
    cost_today = data.get("cost_today", 0)
    baseline_avg = data.get("baseline_avg")
    baseline_std = data.get("baseline_std")
    z_score = data.get("z_score")
    pct_change = data.get("pct_change_7d")
    reason = data.get("anomaly_reason", "Unknown reason")
    dashboard_link = data.get("dashboard_link", f"{DASHBOARD_URL}/service/{service}?date={date}")

    # Compute expected range from baseline avg ± std
    if baseline_avg is not None and baseline_std is not None:
        low = round(baseline_avg - baseline_std, 2)
        high = round(baseline_avg + baseline_std, 2)
        expected_range = f"${low:,.2f} – ${high:,.2f}"
    elif baseline_avg is not None:
        expected_range = f"~${baseline_avg:,.2f}"
    else:
        expected_range = "N/A (insufficient history)"

    blocks = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🚨 FinOps Alert — {service}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Date:*\n{date}"},
                    {"type": "mrkdwn", "text": f"*Cost Today:*\n${cost_today:,.2f}"},
                    {"type": "mrkdwn", "text": f"*Expected Range:*\n{expected_range}"},
                    {"type": "mrkdwn", "text": f"*% Change (7d):*\n{f'{pct_change:+.1f}%' if pct_change is not None else 'N/A'}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Anomaly Reason:*\n{reason}"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "▶ View Dashboard",
                            "emoji": True
                        },
                        "url": dashboard_link,
                        "action_id": "view_dashboard"
                    }
                ]
            }
        ]
    }

    return blocks


def post_to_slack(webhook_url: str, payload: dict) -> int:
    """POST the Block Kit payload to the Slack webhook. Returns HTTP status."""
    data = json.dumps(payload).encode("utf-8")
    req = Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        response = urlopen(req)
        return response.getcode()
    except URLError as e:
        logger.error(f"Slack webhook POST failed: {e}")
        raise


def lambda_handler(event, context):
    """
    Slack Notifier Lambda — receives SNS event with anomaly data,
    formats a Block Kit message, posts to Slack webhook.
    """
    try:
        # Step 1: Parse the SNS event
        anomaly_data = parse_sns_message(event)
        service = anomaly_data.get("service", "Unknown")
        logger.info(f"Processing anomaly alert for {service}")

        # Step 2: Get webhook URL from Secrets Manager
        webhook_url = get_webhook_url()

        # Step 3: Build Block Kit message
        slack_payload = build_slack_blocks(anomaly_data)

        # Step 4: Post to Slack
        status = post_to_slack(webhook_url, slack_payload)
        logger.info(f"Slack notification sent for {service}, status: {status}")

        return {
            "statusCode": 200,
            "service": service,
            "slack_status": status
        }

    except KeyError as e:
        logger.error(f"Missing required field in SNS event: {e}")
        return {"statusCode": 400, "error": f"Missing field: {e}"}

    except Exception as e:
        logger.error(f"Slack notification failed: {e}")
        return {"statusCode": 500, "error": str(e)}
