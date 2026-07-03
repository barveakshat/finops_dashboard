variable "environment" {
  type        = string
  description = "Environment name"
}

variable "ingestor_lambda_arn" {
  type        = string
  description = "ARN of the cost ingestor Lambda function"
}

variable "ingestor_lambda_name" {
  type        = string
  description = "Name of the cost ingestor Lambda function"
}

variable "aggregator_lambda_arn" {
  type        = string
  description = "ARN of the cost aggregator Lambda function"
}

variable "aggregator_lambda_name" {
  type        = string
  description = "Name of the cost aggregator Lambda function"
}
