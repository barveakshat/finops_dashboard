variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS region for all resources"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Environment name (dev, staging, prod)"
}

variable "account_id" {
  type        = string
  description = "12-digit AWS account ID"
}

variable "z_score_threshold" {
  type        = number
  default     = 2.5
  description = "Z-score above which a service cost is flagged as anomalous"
}

variable "spike_threshold_pct" {
  type        = number
  default     = 40
  description = "Percentage change vs 7-day average above which to flag a spike"
}

variable "cost_lookback_days" {
  type        = number
  default     = 2
  description = "Days to look back when pulling Cost Explorer data (T-2 for settled data)"
}

variable "data_retention_days" {
  type        = number
  default     = 90
  description = "DynamoDB TTL in days — records auto-deleted after this period"
}

variable "dashboard_base_url" {
  type        = string
  default     = "https://localhost:3000"
  description = "Base URL for the dashboard (used in Slack alert deep links)"
}

variable "monthly_budget_usd" {
  type        = number
  default     = 500
  description = "Monthly AWS budget in USD for the budget tracking endpoint"
}

variable "slack_secret_name" {
  type        = string
  default     = "finops/slack-webhook-url"
  description = "Secrets Manager secret name for the Slack webhook URL"
}
