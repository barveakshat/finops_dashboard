# ══════════════════════════════════════════════════════════════
# Root Outputs — key values for Person B and integration tests
# ══════════════════════════════════════════════════════════════

output "api_url" {
  value       = module.api_gateway.api_url
  description = "Base URL for the FinOps Dashboard API (share with Person B)"
}

output "raw_table_name" {
  value       = module.dynamodb.raw_table_name
  description = "Name of the cost_raw DynamoDB table"
}

output "agg_table_name" {
  value       = module.dynamodb.agg_table_name
  description = "Name of the cost_aggregated DynamoDB table"
}

output "sns_topic_arn" {
  value       = aws_sns_topic.anomaly_alerts.arn
  description = "ARN of the anomaly alerts SNS topic"
}

output "ingestor_function_name" {
  value       = module.lambda.ingestor_name
  description = "Name of the cost ingestor Lambda function"
}

output "aggregator_function_name" {
  value       = module.lambda.aggregator_name
  description = "Name of the cost aggregator Lambda function"
}

output "anomaly_detector_function_name" {
  value       = module.lambda.anomaly_detector_name
  description = "Name of the anomaly detector Lambda function"
}

output "slack_notifier_function_name" {
  value       = module.lambda.slack_notifier_name
  description = "Name of the Slack notifier Lambda function"
}

output "api_handler_function_name" {
  value       = module.lambda.api_handler_name
  description = "Name of the API handler Lambda function"
}
