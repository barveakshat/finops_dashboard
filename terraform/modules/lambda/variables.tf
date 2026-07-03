variable "environment" {
  type        = string
  description = "Environment name"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "account_id" {
  type        = string
  description = "12-digit AWS account ID"
}

# ── Table references ──

variable "raw_table_name" {
  type        = string
  description = "Name of the cost_raw DynamoDB table"
}

variable "raw_table_arn" {
  type        = string
  description = "ARN of the cost_raw DynamoDB table"
}

variable "agg_table_name" {
  type        = string
  description = "Name of the cost_aggregated DynamoDB table"
}

variable "agg_table_arn" {
  type        = string
  description = "ARN of the cost_aggregated DynamoDB table"
}

# ── SNS ──

variable "sns_topic_arn" {
  type        = string
  description = "ARN of the SNS topic for anomaly alerts"
}

# ── Configurable thresholds ──

variable "z_score_threshold" {
  type        = number
  description = "Z-score threshold for anomaly detection"
}

variable "spike_threshold_pct" {
  type        = number
  description = "Percentage spike threshold"
}

variable "cost_lookback_days" {
  type        = number
  description = "Days to look back for Cost Explorer (T-2)"
}

variable "data_retention_days" {
  type        = number
  description = "DynamoDB TTL retention in days"
}

variable "dashboard_base_url" {
  type        = string
  description = "Dashboard base URL for deep links"
}

variable "monthly_budget_usd" {
  type        = number
  description = "Monthly AWS budget in USD"
}

variable "slack_secret_name" {
  type        = string
  description = "Secrets Manager secret name for Slack webhook URL"
}
