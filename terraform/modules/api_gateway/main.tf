# ──────────────────────────────────────────────
# API Gateway Module — HTTP API (v2)
# ──────────────────────────────────────────────

resource "aws_apigatewayv2_api" "finops_api" {
  name          = "finops-dashboard-api-${var.environment}"
  protocol_type = "HTTP"
  description   = "FinOps Dashboard API — serves cost data to the frontend"

  cors_configuration {
    allow_origins = ["http://localhost:5173", "http://localhost:3000", "*"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With", "X-Account-Id"]
    expose_headers = ["Content-Type"]
    max_age       = 3600
  }

  tags = {
    Name = "finops-api-${var.environment}"
  }
}

# Lambda integration — all routes go to the api-handler Lambda
resource "aws_apigatewayv2_integration" "api_handler" {
  api_id                 = aws_apigatewayv2_api.finops_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.api_handler_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# ──────────────────────────────────────────────
# JWT Authorizer — validates Cognito tokens
# before requests reach the Lambda integration.
# ──────────────────────────────────────────────

resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  api_id           = aws_apigatewayv2_api.finops_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "finops-cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = var.cognito_issuer
  }
}

# ──────────────────────────────────────────────
# Routes — one per API contract endpoint
# IMPORTANT: both authorization_type AND authorizer_id
# must be set on every route. If authorizer_id is set
# but authorization_type is missing, API Gateway silently
# lets unauthenticated requests through.
# ──────────────────────────────────────────────

resource "aws_apigatewayv2_route" "get_costs" {
  api_id    = aws_apigatewayv2_api.finops_api.id
  route_key = "GET /costs"
  target    = "integrations/${aws_apigatewayv2_integration.api_handler.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "get_service_costs" {
  api_id    = aws_apigatewayv2_api.finops_api.id
  route_key = "GET /costs/{service}"
  target    = "integrations/${aws_apigatewayv2_integration.api_handler.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "get_anomalies" {
  api_id    = aws_apigatewayv2_api.finops_api.id
  route_key = "GET /anomalies"
  target    = "integrations/${aws_apigatewayv2_integration.api_handler.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "get_budget" {
  api_id    = aws_apigatewayv2_api.finops_api.id
  route_key = "GET /budget/{month}"
  target    = "integrations/${aws_apigatewayv2_integration.api_handler.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# ──────────────────────────────────────────────
# Stage — auto-deploy on changes
# ──────────────────────────────────────────────

resource "aws_apigatewayv2_stage" "v1" {
  api_id      = aws_apigatewayv2_api.finops_api.id
  name        = "v1"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = {
    Name = "finops-api-v1-${var.environment}"
  }
}

resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/finops-dashboard-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "finops-api-logs-${var.environment}"
  }
}

# ──────────────────────────────────────────────
# Lambda Permission — allow API Gateway to invoke
# ──────────────────────────────────────────────

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.api_handler_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.finops_api.execution_arn}/*/*"
}

# ──────────────────────────────────────────────
# Outputs
# ──────────────────────────────────────────────

output "api_url" {
  value       = "${aws_apigatewayv2_api.finops_api.api_endpoint}/v1"
  description = "Base URL for the FinOps Dashboard API"
}

output "api_id" {
  value = aws_apigatewayv2_api.finops_api.id
}
