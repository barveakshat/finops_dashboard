# ══════════════════════════════════════════════════════════════
# Lambda Module — 5 functions, per-function IAM, packaging
# ══════════════════════════════════════════════════════════════

locals {
  src_dir     = "${path.module}/src"
  runtime     = "python3.12"
  common_tags = { Module = "lambda" }
}

# ──────────────────────────────────────────────
# 1. COST INGESTOR
# ──────────────────────────────────────────────

data "archive_file" "ingestor" {
  type        = "zip"
  source_dir  = "${local.src_dir}/ingestor"
  output_path = "${path.module}/.build/ingestor.zip"
  excludes    = ["__pycache__"]
}

resource "aws_iam_role" "ingestor" {
  name = "finops-ingestor-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ingestor" {
  name = "finops-ingestor-policy-${var.environment}"
  role = aws_iam_role.ingestor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBWriteRaw"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = var.raw_table_arn
      },
      {
        Sid    = "CostExplorerRead"
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage",
          "ce:GetCostForecast"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.account_id}:*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "ingestor" {
  name              = "/aws/lambda/finops-cost-ingestor-${var.environment}"
  retention_in_days = 30
}

resource "aws_lambda_function" "ingestor" {
  function_name    = "finops-cost-ingestor-${var.environment}"
  role             = aws_iam_role.ingestor.arn
  handler          = "handler.lambda_handler"
  runtime          = local.runtime
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.ingestor.output_path
  source_code_hash = data.archive_file.ingestor.output_base64sha256

  environment {
    variables = {
      DYNAMODB_RAW_TABLE  = var.raw_table_name
      ACCOUNT_ID          = var.account_id
      COST_LOOKBACK_DAYS  = tostring(var.cost_lookback_days)
      DATA_RETENTION_DAYS = tostring(var.data_retention_days)
    }
  }

  depends_on = [
    aws_iam_role_policy.ingestor,
    aws_cloudwatch_log_group.ingestor
  ]

  tags = merge(local.common_tags, { Function = "cost-ingestor" })
}

# ──────────────────────────────────────────────
# 2. COST AGGREGATOR
# ──────────────────────────────────────────────

data "archive_file" "aggregator" {
  type        = "zip"
  source_dir  = "${local.src_dir}/aggregator"
  output_path = "${path.module}/.build/aggregator.zip"
  excludes    = ["__pycache__"]
}

resource "aws_iam_role" "aggregator" {
  name = "finops-aggregator-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "aggregator" {
  name = "finops-aggregator-policy-${var.environment}"
  role = aws_iam_role.aggregator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBReadRaw"
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:GetItem"
        ]
        Resource = var.raw_table_arn
      },
      {
        Sid    = "DynamoDBReadWriteAgg"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:Scan"
        ]
        Resource = [
          var.agg_table_arn,
          "${var.agg_table_arn}/index/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.account_id}:*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "aggregator" {
  name              = "/aws/lambda/finops-cost-aggregator-${var.environment}"
  retention_in_days = 30
}

resource "aws_lambda_function" "aggregator" {
  function_name    = "finops-cost-aggregator-${var.environment}"
  role             = aws_iam_role.aggregator.arn
  handler          = "handler.lambda_handler"
  runtime          = local.runtime
  timeout          = 120
  memory_size      = 256
  filename         = data.archive_file.aggregator.output_path
  source_code_hash = data.archive_file.aggregator.output_base64sha256

  environment {
    variables = {
      DYNAMODB_RAW_TABLE  = var.raw_table_name
      DYNAMODB_AGG_TABLE  = var.agg_table_name
      ACCOUNT_ID          = var.account_id
      DATA_RETENTION_DAYS = tostring(var.data_retention_days)
    }
  }

  depends_on = [
    aws_iam_role_policy.aggregator,
    aws_cloudwatch_log_group.aggregator
  ]

  tags = merge(local.common_tags, { Function = "cost-aggregator" })
}

# ──────────────────────────────────────────────
# 3. ANOMALY DETECTOR
# ──────────────────────────────────────────────

data "archive_file" "anomaly_detector" {
  type        = "zip"
  source_dir  = "${local.src_dir}/anomaly_detector"
  output_path = "${path.module}/.build/anomaly_detector.zip"
  excludes    = ["__pycache__"]
}

resource "aws_iam_role" "anomaly_detector" {
  name = "finops-anomaly-detector-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "anomaly_detector" {
  name = "finops-anomaly-detector-policy-${var.environment}"
  role = aws_iam_role.anomaly_detector.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBReadWriteAgg"
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:PutItem"
        ]
        Resource = [
          var.agg_table_arn,
          "${var.agg_table_arn}/index/*"
        ]
      },
      {
        Sid      = "SNSPublish"
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = var.sns_topic_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.account_id}:*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "anomaly_detector" {
  name              = "/aws/lambda/finops-anomaly-detector-${var.environment}"
  retention_in_days = 30
}

resource "aws_lambda_function" "anomaly_detector" {
  function_name    = "finops-anomaly-detector-${var.environment}"
  role             = aws_iam_role.anomaly_detector.arn
  handler          = "handler.lambda_handler"
  runtime          = local.runtime
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.anomaly_detector.output_path
  source_code_hash = data.archive_file.anomaly_detector.output_base64sha256

  environment {
    variables = {
      DYNAMODB_AGG_TABLE  = var.agg_table_name
      SNS_TOPIC_ARN       = var.sns_topic_arn
      Z_SCORE_THRESHOLD   = tostring(var.z_score_threshold)
      SPIKE_THRESHOLD_PCT = tostring(var.spike_threshold_pct)
      DASHBOARD_BASE_URL  = var.dashboard_base_url
    }
  }

  depends_on = [
    aws_iam_role_policy.anomaly_detector,
    aws_cloudwatch_log_group.anomaly_detector
  ]

  tags = merge(local.common_tags, { Function = "anomaly-detector" })
}

# ──────────────────────────────────────────────
# 4. SLACK NOTIFIER
# ──────────────────────────────────────────────

data "archive_file" "slack_notifier" {
  type        = "zip"
  source_dir  = "${local.src_dir}/slack_notifier"
  output_path = "${path.module}/.build/slack_notifier.zip"
  excludes    = ["__pycache__"]
}

resource "aws_iam_role" "slack_notifier" {
  name = "finops-slack-notifier-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "slack_notifier" {
  name = "finops-slack-notifier-policy-${var.environment}"
  role = aws_iam_role.slack_notifier.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerRead"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.account_id}:secret:${var.slack_secret_name}*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.account_id}:*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "slack_notifier" {
  name              = "/aws/lambda/finops-slack-notifier-${var.environment}"
  retention_in_days = 30
}

resource "aws_lambda_function" "slack_notifier" {
  function_name    = "finops-slack-notifier-${var.environment}"
  role             = aws_iam_role.slack_notifier.arn
  handler          = "handler.lambda_handler"
  runtime          = local.runtime
  timeout          = 15
  memory_size      = 128
  filename         = data.archive_file.slack_notifier.output_path
  source_code_hash = data.archive_file.slack_notifier.output_base64sha256

  environment {
    variables = {
      SLACK_SECRET_NAME  = var.slack_secret_name
      DASHBOARD_BASE_URL = var.dashboard_base_url
    }
  }

  depends_on = [
    aws_iam_role_policy.slack_notifier,
    aws_cloudwatch_log_group.slack_notifier
  ]

  tags = merge(local.common_tags, { Function = "slack-notifier" })
}

# ──────────────────────────────────────────────
# 5. API HANDLER
# ──────────────────────────────────────────────

data "archive_file" "api_handler" {
  type        = "zip"
  source_dir  = "${local.src_dir}/api_handler"
  output_path = "${path.module}/.build/api_handler.zip"
  excludes    = ["__pycache__"]
}

resource "aws_iam_role" "api_handler" {
  name = "finops-api-handler-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "api_handler" {
  name = "finops-api-handler-policy-${var.environment}"
  role = aws_iam_role.api_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBReadAgg"
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:Scan"
        ]
        Resource = [
          var.agg_table_arn,
          "${var.agg_table_arn}/index/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.account_id}:*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "api_handler" {
  name              = "/aws/lambda/finops-api-handler-${var.environment}"
  retention_in_days = 30
}

resource "aws_lambda_function" "api_handler" {
  function_name    = "finops-api-handler-${var.environment}"
  role             = aws_iam_role.api_handler.arn
  handler          = "handler.lambda_handler"
  runtime          = local.runtime
  timeout          = 29
  memory_size      = 512
  filename         = data.archive_file.api_handler.output_path
  source_code_hash = data.archive_file.api_handler.output_base64sha256

  environment {
    variables = {
      DYNAMODB_AGG_TABLE = var.agg_table_name
      MONTHLY_BUDGET_USD = tostring(var.monthly_budget_usd)
    }
  }

  depends_on = [
    aws_iam_role_policy.api_handler,
    aws_cloudwatch_log_group.api_handler
  ]

  tags = merge(local.common_tags, { Function = "api-handler" })
}

# ══════════════════════════════════════════════════════════════
# Outputs
# ══════════════════════════════════════════════════════════════

output "ingestor_arn" {
  value = aws_lambda_function.ingestor.arn
}

output "ingestor_name" {
  value = aws_lambda_function.ingestor.function_name
}

output "aggregator_arn" {
  value = aws_lambda_function.aggregator.arn
}

output "aggregator_name" {
  value = aws_lambda_function.aggregator.function_name
}

output "anomaly_detector_arn" {
  value = aws_lambda_function.anomaly_detector.arn
}

output "anomaly_detector_name" {
  value = aws_lambda_function.anomaly_detector.function_name
}

output "slack_notifier_arn" {
  value = aws_lambda_function.slack_notifier.arn
}

output "slack_notifier_name" {
  value = aws_lambda_function.slack_notifier.function_name
}

output "api_handler_arn" {
  value = aws_lambda_function.api_handler.arn
}

output "api_handler_name" {
  value = aws_lambda_function.api_handler.function_name
}

output "api_handler_invoke_arn" {
  value = aws_lambda_function.api_handler.invoke_arn
}
