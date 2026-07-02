variable "environment" {
  type        = string
  description = "Environment name"
}

variable "sns_topic_arn" {
  type        = string
  description = "ARN of the SNS topic (created in root module)"
}

variable "slack_notifier_lambda_arn" {
  type        = string
  description = "ARN of the Slack notifier Lambda function"
}

variable "slack_notifier_lambda_name" {
  type        = string
  description = "Name of the Slack notifier Lambda function"
}
