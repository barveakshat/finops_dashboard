variable "environment" {
  type        = string
  description = "Environment name"
}

variable "api_handler_lambda_arn" {
  type        = string
  description = "ARN of the API handler Lambda function"
}

variable "api_handler_invoke_arn" {
  type        = string
  description = "Invoke ARN of the API handler Lambda function (required for API Gateway integration)"
}

variable "api_handler_lambda_name" {
  type        = string
  description = "Name of the API handler Lambda function"
}
