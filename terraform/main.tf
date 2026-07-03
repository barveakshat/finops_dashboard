# ══════════════════════════════════════════════════════════════
# Root Module — Wires all child modules together
# ══════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────
# DynamoDB — cost_raw + cost_aggregated tables
# ──────────────────────────────────────────────

module "dynamodb" {
  source      = "./modules/dynamodb"
  environment = var.environment
}

# ──────────────────────────────────────────────
# SNS Topic — created here to break the circular
# dependency between Lambda and SNS modules.
# Lambda needs the topic ARN for env vars.
# SNS subscriptions need Lambda ARNs.
# ──────────────────────────────────────────────

resource "aws_sns_topic" "anomaly_alerts" {
  name = "finops-anomaly-alerts-${var.environment}"

  tags = {
    Name = "finops-anomaly-alerts-${var.environment}"
  }
}

# ──────────────────────────────────────────────
# Lambda — 5 functions with per-function IAM
# ──────────────────────────────────────────────

module "lambda" {
  source      = "./modules/lambda"
  environment = var.environment
  aws_region  = var.aws_region
  account_id  = var.account_id

  # Table references
  raw_table_name = module.dynamodb.raw_table_name
  raw_table_arn  = module.dynamodb.raw_table_arn
  agg_table_name = module.dynamodb.agg_table_name
  agg_table_arn  = module.dynamodb.agg_table_arn

  # SNS topic for anomaly alerts
  sns_topic_arn = aws_sns_topic.anomaly_alerts.arn

  # Configurable thresholds — tune via terraform.tfvars
  z_score_threshold   = var.z_score_threshold
  spike_threshold_pct = var.spike_threshold_pct
  cost_lookback_days  = var.cost_lookback_days
  data_retention_days = var.data_retention_days
  dashboard_base_url  = var.dashboard_base_url
  monthly_budget_usd  = var.monthly_budget_usd
  slack_secret_name   = var.slack_secret_name
}

# ──────────────────────────────────────────────
# SNS Alerting — subscriptions (topic is above)
# ──────────────────────────────────────────────

module "sns_alerting" {
  source      = "./modules/sns_alerting"
  environment = var.environment

  sns_topic_arn              = aws_sns_topic.anomaly_alerts.arn
  slack_notifier_lambda_arn  = module.lambda.slack_notifier_arn
  slack_notifier_lambda_name = module.lambda.slack_notifier_name
}

# ──────────────────────────────────────────────
# EventBridge — daily cron schedules
# ──────────────────────────────────────────────

module "eventbridge" {
  source      = "./modules/eventbridge"
  environment = var.environment

  ingestor_lambda_arn    = module.lambda.ingestor_arn
  ingestor_lambda_name   = module.lambda.ingestor_name
  aggregator_lambda_arn  = module.lambda.aggregator_arn
  aggregator_lambda_name = module.lambda.aggregator_name
}

# ──────────────────────────────────────────────
# API Gateway — HTTP API with 4 routes
# ──────────────────────────────────────────────

module "api_gateway" {
  source      = "./modules/api_gateway"
  environment = var.environment

  api_handler_lambda_arn  = module.lambda.api_handler_arn
  api_handler_invoke_arn  = module.lambda.api_handler_invoke_arn
  api_handler_lambda_name = module.lambda.api_handler_name
}
