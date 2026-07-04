import os
import json
import boto3
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION     = os.environ.get("AWS_REGION", "ap-south-1")
AGG_TABLE  = os.environ.get("DYNAMODB_AGG_TABLE", "cost_aggregated")
BUDGET_USD = float(os.environ.get("MONTHLY_BUDGET_USD", "500.00"))

# Allowed CORS origins — includes Vite dev server and localhost:3000
CORS_ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://localhost:3000",
}

# Lazy global
_agg_table = None


def get_agg_table():
    global _agg_table
    if _agg_table is None:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        _agg_table = dynamodb.Table(AGG_TABLE)
    return _agg_table


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal types from DynamoDB."""
    def default(self, o):
        if isinstance(o, Decimal):
            # Return int if no decimal places, else float
            if o == int(o):
                return int(o)
            return float(o)
        return super().default(o)


def resolve_cors_origin(event: dict) -> str:
    """Return the correct Access-Control-Allow-Origin value.

    If the request's Origin header matches an allowed origin, echo it back.
    Otherwise fall back to wildcard for non-browser clients (curl, etc.).
    """
    headers = event.get("headers") or {}
    # API Gateway v2 lowercases all header names
    origin = headers.get("origin", headers.get("Origin", ""))
    if origin in CORS_ALLOWED_ORIGINS:
        return origin
    return "*"


def api_response(status_code: int, body: dict, event: dict = None) -> dict:
    """Standard API Gateway response wrapper with CORS headers."""
    origin = resolve_cors_origin(event) if event else "*"
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
            "Vary": "Origin"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }


def parse_period(period_str: str) -> tuple[str, str]:
    """Convert period string (7d, 14d, 30d) to (start_date, end_date)."""
    days = int(period_str.replace("d", ""))
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    return start_date, end_date


def handle_get_costs(query_params: dict) -> dict:
    """GET /costs — returns all services aggregated for a period."""
    period = query_params.get("period", "7d")
    start_date, end_date = parse_period(period)
    table = get_agg_table()

    # Query each date in the range
    records = []
    total_cost = 0.0
    current = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        response = table.query(
            KeyConditionExpression=Key("date").eq(date_str)
        )
        for item in response.get("Items", []):
            cost = float(item.get("total_cost", 0))
            total_cost += cost
            records.append({
                "date": item["date"],
                "service": item["service"],
                "total_usd": round(cost, 2),
                "is_anomaly": item.get("is_anomaly", False),
                "anomaly_reason": item.get("anomaly_reason") if item.get("anomaly_reason") != "none" else None,
                "pct_change_7d": float(item["pct_change_7d"]) if item.get("pct_change_7d") else None
            })
        current += timedelta(days=1)

    return {
        "period": f"{start_date} to {end_date}",
        "total_cost_usd": round(total_cost, 2),
        "records": records
    }


def handle_get_service_trend(service: str, query_params: dict) -> dict:
    """GET /costs/{service} — returns trend data for a single service."""
    period = query_params.get("period", "30d")
    start_date, end_date = parse_period(period)
    table = get_agg_table()

    response = table.query(
        IndexName="service-date-index",
        KeyConditionExpression=Key("service").eq(service) & Key("date").between(start_date, end_date),
        ScanIndexForward=True
    )

    trend = []
    for item in response.get("Items", []):
        trend.append({
            "date": item["date"],
            "total_usd": round(float(item.get("total_cost", 0)), 2),
            "baseline_30d_avg": float(item["baseline_30d_avg"]) if item.get("baseline_30d_avg") else None,
            "z_score": float(item["z_score"]) if item.get("z_score") else None,
            "is_anomaly": item.get("is_anomaly", False)
        })

    return {
        "service": service,
        "period": f"{start_date} to {end_date}",
        "trend": trend
    }


def handle_get_anomalies(query_params: dict) -> dict:
    """GET /anomalies — returns flagged anomalies for a period."""
    period = query_params.get("period", "7d")
    start_date, end_date = parse_period(period)
    table = get_agg_table()

    anomalies = []
    current = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        response = table.query(
            KeyConditionExpression=Key("date").eq(date_str)
        )
        for item in response.get("Items", []):
            if item.get("is_anomaly") is True:
                anomalies.append({
                    "date": item["date"],
                    "service": item["service"],
                    "cost_today": round(float(item.get("total_cost", 0)), 2),
                    "baseline_avg": float(item["baseline_30d_avg"]) if item.get("baseline_30d_avg") else None,
                    "z_score": float(item["z_score"]) if item.get("z_score") else None,
                    "pct_change_7d": float(item["pct_change_7d"]) if item.get("pct_change_7d") else None,
                    "anomaly_reason": item.get("anomaly_reason") if item.get("anomaly_reason") != "none" else None
                })
        current += timedelta(days=1)

    return {
        "period": f"{start_date} to {end_date}",
        "anomalies": anomalies
    }


def handle_get_budget(month: str) -> dict:
    """GET /budget/{month} — returns spend vs budget for a month."""
    table = get_agg_table()

    # Parse month (YYYY-MM) to get date range
    try:
        month_start = datetime.strptime(f"{month}-01", "%Y-%m-%d")
    except ValueError:
        return {"error": f"Invalid month format: {month}. Use YYYY-MM."}

    # Calculate month end
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    days_in_month = (month_end - month_start).days
    today = datetime.utcnow()

    # Calculate days remaining (0 if month is in the past)
    if today < month_start:
        days_elapsed = 0
        days_remaining = days_in_month
    elif today >= month_end:
        days_elapsed = days_in_month
        days_remaining = 0
    else:
        days_elapsed = (today - month_start).days + 1
        days_remaining = days_in_month - days_elapsed

    # Query all dates in the month
    total_spent = 0.0
    current = month_start
    while current < month_end and current <= today:
        date_str = current.strftime("%Y-%m-%d")
        response = table.query(
            KeyConditionExpression=Key("date").eq(date_str)
        )
        for item in response.get("Items", []):
            total_spent += float(item.get("total_cost", 0))
        current += timedelta(days=1)

    total_spent = round(total_spent, 2)
    pct_used = round((total_spent / BUDGET_USD) * 100, 1) if BUDGET_USD > 0 else 0

    # Project total based on daily average
    if days_elapsed > 0:
        daily_avg = total_spent / days_elapsed
        projected_total = round(daily_avg * days_in_month, 2)
    else:
        projected_total = 0.0

    return {
        "month": month,
        "budget_usd": BUDGET_USD,
        "spent_usd": total_spent,
        "pct_used": pct_used,
        "days_remaining": days_remaining,
        "projected_total": projected_total
    }


def lambda_handler(event, context):
    """
    API Handler Lambda — routes API Gateway requests to the correct handler.
    Supports: GET /costs, GET /costs/{service}, GET /anomalies, GET /budget/{month}
    """
    logger.info(f"API request: {json.dumps(event)}")

    # Extract route info from API Gateway event
    http_method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "GET"))
    path = event.get("path", event.get("rawPath", "/"))
    query_params = event.get("queryStringParameters") or {}
    path_params = event.get("pathParameters") or {}

    try:
        # Route: GET /costs/{service}
        if path.startswith("/costs/") and "service" in path_params:
            service = path_params["service"]
            body = handle_get_service_trend(service, query_params)
            return api_response(200, body, event)

        # Route: GET /costs
        if path == "/costs" or path == "/costs/":
            body = handle_get_costs(query_params)
            return api_response(200, body, event)

        # Route: GET /anomalies
        if path == "/anomalies" or path == "/anomalies/":
            body = handle_get_anomalies(query_params)
            return api_response(200, body, event)

        # Route: GET /budget/{month}
        if path.startswith("/budget/") and "month" in path_params:
            month = path_params["month"]
            body = handle_get_budget(month)
            return api_response(200, body, event)

        # Unknown route
        return api_response(404, {"error": "Not found", "path": path}, event)

    except Exception as e:
        logger.error(f"API handler error: {e}", exc_info=True)
        return api_response(500, {"error": "Internal server error"}, event)
