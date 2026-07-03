# ──────────────────────────────────────────────
# SNS Alerting Module — Subscriptions & permissions
# (SNS topic is created in root main.tf to avoid
#  circular dependency with Lambda module)
# ──────────────────────────────────────────────

# Subscribe the Slack notifier Lambda to the SNS topic
resource "aws_sns_topic_subscription" "slack_notifier" {
  topic_arn = var.sns_topic_arn
  protocol  = "lambda"
  endpoint  = var.slack_notifier_lambda_arn
}

# Allow SNS to invoke the Slack notifier Lambda
resource "aws_lambda_permission" "sns_slack_notifier" {
  statement_id  = "AllowSNSInvokeSlackNotifier"
  action        = "lambda:InvokeFunction"
  function_name = var.slack_notifier_lambda_name
  principal     = "sns.amazonaws.com"
  source_arn    = var.sns_topic_arn
}
