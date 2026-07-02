# ──────────────────────────────────────────────
# EventBridge Module — Daily cron schedules
# ──────────────────────────────────────────────

# Ingestor: fires at 6:00 AM UTC daily
resource "aws_cloudwatch_event_rule" "ingestor_schedule" {
  name                = "finops-ingestor-daily-${var.environment}"
  description         = "Trigger cost ingestor Lambda daily at 6:00 AM UTC"
  schedule_expression = "cron(0 6 * * ? *)"

  tags = {
    Name = "finops-ingestor-schedule-${var.environment}"
  }
}

resource "aws_cloudwatch_event_target" "ingestor" {
  rule      = aws_cloudwatch_event_rule.ingestor_schedule.name
  target_id = "IngestorLambda"
  arn       = var.ingestor_lambda_arn
}

resource "aws_lambda_permission" "eventbridge_ingestor" {
  statement_id  = "AllowEventBridgeInvokeIngestor"
  action        = "lambda:InvokeFunction"
  function_name = var.ingestor_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ingestor_schedule.arn
}

# Aggregator: fires at 6:30 AM UTC daily (30 min after ingestor)
resource "aws_cloudwatch_event_rule" "aggregator_schedule" {
  name                = "finops-aggregator-daily-${var.environment}"
  description         = "Trigger cost aggregator Lambda daily at 6:30 AM UTC"
  schedule_expression = "cron(30 6 * * ? *)"

  tags = {
    Name = "finops-aggregator-schedule-${var.environment}"
  }
}

resource "aws_cloudwatch_event_target" "aggregator" {
  rule      = aws_cloudwatch_event_rule.aggregator_schedule.name
  target_id = "AggregatorLambda"
  arn       = var.aggregator_lambda_arn
}

resource "aws_lambda_permission" "eventbridge_aggregator" {
  statement_id  = "AllowEventBridgeInvokeAggregator"
  action        = "lambda:InvokeFunction"
  function_name = var.aggregator_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.aggregator_schedule.arn
}
