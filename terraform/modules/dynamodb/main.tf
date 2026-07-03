# ──────────────────────────────────────────────
# DynamoDB Module — Two tables for cost data
# ──────────────────────────────────────────────

resource "aws_dynamodb_table" "cost_raw" {
  name         = "cost_raw"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "service_account"
  range_key    = "date"

  attribute {
    name = "service_account"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "finops-cost-raw-${var.environment}"
  }
}

resource "aws_dynamodb_table" "cost_aggregated" {
  name         = "cost_aggregated"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "date"
  range_key    = "service"

  attribute {
    name = "date"
    type = "S"
  }

  attribute {
    name = "service"
    type = "S"
  }

  global_secondary_index {
    name            = "service-date-index"
    hash_key        = "service"
    range_key       = "date"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "finops-cost-aggregated-${var.environment}"
  }
}

# ──────────────────────────────────────────────
# Outputs
# ──────────────────────────────────────────────

output "raw_table_name" {
  value = aws_dynamodb_table.cost_raw.name
}

output "agg_table_name" {
  value = aws_dynamodb_table.cost_aggregated.name
}

output "raw_table_arn" {
  value = aws_dynamodb_table.cost_raw.arn
}

output "agg_table_arn" {
  value = aws_dynamodb_table.cost_aggregated.arn
}
