variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
}

variable "account_id" {
  type        = string
  description = "12-digit AWS account ID — used as suffix in the Cognito domain to guarantee global uniqueness"
}

variable "aws_region" {
  type        = string
  description = "AWS region — used to construct the Cognito issuer URL"
}

variable "dashboard_callback_urls" {
  type        = list(string)
  default     = ["http://localhost:5173"]
  description = "OAuth callback URLs for the user pool client (add production URL when deploying)"
}

variable "dashboard_logout_urls" {
  type        = list(string)
  default     = ["http://localhost:5173"]
  description = "OAuth logout URLs for the user pool client"
}
