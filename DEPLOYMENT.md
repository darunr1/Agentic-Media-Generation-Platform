# Deployment

Production targets Cloud Run for web/worker, Cloud Run Jobs for rendering, Cloud SQL PostgreSQL, private GCS, Cloud Tasks, Cloud Scheduler, Secret Manager, Artifact Registry, Logging, and Monitoring. Terraform lives in `infra/terraform` and enables deletion protection for stateful and serving resources.

Build immutable images, populate Secret Manager outside Terraform state, run migrations as a release job, then shift traffic. Use GitHub Workload Identity Federation instead of service-account keys. Add uptime checks for `/healthz` and `/readyz`, alerts for dead letters/payment failures, budgets, Cloud SQL PITR, and media lifecycle policies. Deployment is disabled until the project, remote state, identity provider, DNS, and secrets are approved.
