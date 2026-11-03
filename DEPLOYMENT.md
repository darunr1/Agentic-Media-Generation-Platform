# Deployment

The verified runtime is a Node web server, a persistent polling worker and a persistent polling renderer, all using the same PostgreSQL database and media directory. FFmpeg and an available Arial or DejaVu Sans font are needed by the renderer and seed. Start with README's local setup. Docker Compose defines this topology and shares one media volume; run migrations and seed before accepting traffic. Docker was unavailable in the implementation environment, so image builds and Compose startup are not locally verified.

Use HTTPS, a stable APP_URL, production authentication, strong AUTH_SECRET and ENCRYPTION_KEY, private database networking and backups. Disable development login in production. Run Prisma migrations once as a release step, then start all three applications. Health endpoints check the database; they do not certify paid provider credentials. Keep worker and renderer alive for scheduled work. SIGTERM stops new reservations and grants active work 25 seconds before aborting; leases permit later recovery.

The GCP Terraform and deployment workflow are scaffolding. Cloud Tasks/GCS are not implemented adapters, and the current polling renderer is not a drop-in Cloud Run Job. Choose persistent compute, or explicitly redesign dispatch for Cloud Run Jobs; do not enable the scaffold expecting a working deployment. GCP requires a project, billing, remote state, IAM/workload identity, secrets, network policy and tested storage/queue adapters. DNS, TLS, external auth, monitoring, alerts and recovery drills are operator setup. No cloud deployment, DNS changes, Stripe setup or real social publishing was performed.

## Text-to-speech rollout (D03)

OpenAI TTS configuration and the standalone provider selector exist, but **OpenAI TTS is not supported by the production pipeline yet**. The `generation.voice` worker still produces only the mock reference tone. Set `AI_TTS_PROVIDER=mock` for deployments and local tests. Selecting `AI_TTS_PROVIDER=openai` **fails at startup** with an explicit validation error until D04 wires real speech generation; it never silently falls back to mock audio.

`OPENAI_TTS_MODEL` and `OPENAI_TTS_VOICE` are documented for the future integration and do not activate it. `OPENAI_API_KEY` is a **shared OpenAI key** used by other OpenAI providers and is listed separately in `.env.example`. Do not enable OpenAI TTS in production before D04.
