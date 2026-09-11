# Google Cloud setup

Create a billing-enabled project, a Terraform state bucket, and a GitHub Workload Identity provider. Authenticate Terraform with application-default credentials, copy `infra/terraform` into the approved state workflow, and supply project, region, and immutable image variables. Apply in a non-production project first.

After infrastructure creation, add Secret Manager versions for database URL, Auth.js secret, encryption key, and optional provider keys; grant the runtime service account only accessor rights to named secrets plus its bucket/queue/database roles. Run migrations from a controlled release job. Configure custom domain/TLS, OAuth callback URLs, scheduler OIDC audience, monitoring, budgets, backups, and incident contacts before traffic.

Never place secret values in Terraform variables, CI logs, image layers, or repository files.
