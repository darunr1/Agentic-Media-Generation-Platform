variable "project_id" { type = string }
variable "region" { type = string default = "us-central1" }
variable "environment" { type = string default = "production" }
variable "web_image" { type = string }
variable "worker_image" { type = string }
variable "renderer_image" { type = string }
