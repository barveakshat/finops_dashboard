# ──────────────────────────────────────────────
# Cognito Module — User Pool + Client + Domain
# ──────────────────────────────────────────────

resource "aws_cognito_user_pool" "finops" {
  name = "finops-dashboard-${var.environment}"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  auto_verified_attributes = ["email"]

  tags = {
    Name = "finops-dashboard-${var.environment}"
  }
}

resource "aws_cognito_user_pool_client" "finops_client" {
  name         = "finops-dashboard-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.finops.id

  # Public client — React SPA, no client secret
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  callback_urls = var.dashboard_callback_urls
  logout_urls   = var.dashboard_logout_urls

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  allowed_oauth_flows_user_pool_client = true
  supported_identity_providers         = ["COGNITO"]
}

# Domain must be globally unique across all Cognito users in the region.
# The account_id suffix prevents "domain already exists" errors on apply.
resource "aws_cognito_user_pool_domain" "finops_domain" {
  domain       = "finops-dashboard-${var.environment}-${var.account_id}"
  user_pool_id = aws_cognito_user_pool.finops.id
}

# ──────────────────────────────────────────────
# Outputs
# ──────────────────────────────────────────────

output "user_pool_id" {
  value       = aws_cognito_user_pool.finops.id
  description = "Cognito User Pool ID"
}

output "user_pool_client_id" {
  value       = aws_cognito_user_pool_client.finops_client.id
  description = "Cognito User Pool Client ID (public, no secret)"
}

output "user_pool_issuer" {
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.finops.id}"
  description = "Cognito issuer URL — used by the JWT authorizer to validate tokens"
}

output "hosted_ui_domain" {
  value       = "${aws_cognito_user_pool_domain.finops_domain.domain}.auth.${var.aws_region}.amazoncognito.com"
  description = "Hosted UI domain — Person B uses this for OAuth redirect"
}
