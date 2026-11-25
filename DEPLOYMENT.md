# Deployment

The verified runtime is a Node web server, a persistent polling worker and a persistent polling renderer, all using the same PostgreSQL database and media directory. FFmpeg and an available Arial or DejaVu Sans font are needed by the renderer and seed. Start with README's local setup. Docker Compose defines this topology and shares one media volume; run migrations and seed before accepting traffic. Docker was unavailable in the implementation environment, so image builds and Compose startup are not locally verified.

Use HTTPS, a stable APP_URL, production authentication, strong AUTH_SECRET and ENCRYPTION_KEY, private database networking and backups. Disable development login in production. Run Prisma migrations once as a release step, then start all three applications. Health endpoints check the database; they do not certify paid provider credentials. Keep worker and renderer alive for scheduled work. SIGTERM stops new reservations and grants active work 25 seconds before aborting; leases permit later recovery.

The GCP Terraform and deployment workflow are scaffolding. Cloud Tasks/GCS are not implemented adapters, and the current polling renderer is not a drop-in Cloud Run Job. Choose persistent compute, or explicitly redesign dispatch for Cloud Run Jobs; do not enable the scaffold expecting a working deployment. GCP requires a project, billing, remote state, IAM/workload identity, secrets, network policy and tested storage/queue adapters. DNS, TLS, external auth, monitoring, alerts and recovery drills are operator setup. No cloud deployment, DNS changes, Stripe setup or real social publishing was performed.

## Narrated video

The worker defaults to `AI_TTS_PROVIDER=mock`, which generates a reference tone locally. To narrate the saved script with OpenAI, set `AI_TTS_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_TTS_MODEL`, and `OPENAI_TTS_VOICE`. Restart the worker after changing configuration. A real request can incur provider charges. The worker normalizes returned speech to mono WAV and rejects speech beyond the renderer’s 60-second limit. Provider failures follow the queue retry policy. To switch new jobs back to the reference tone, set `AI_TTS_PROVIDER=mock` and restart the worker.

## Staging authentication (T08)

For hosted staging, set `APP_DEPLOYMENT=staging` and `NODE_ENV=production`.
Use the standalone staging Compose stack (T07) when available. Do not expose
the app until this section's checks succeed. The runtime rejects insecure
hosted configuration; local production-mode builds remain supported.

- Set `APP_URL` to the canonical external HTTPS origin, without a trailing
  slash, and `AUTH_URL` to the same value. Install a valid TLS certificate,
  redirect HTTP to HTTPS, and bind the application to a private/loopback
  interface. The trusted reverse proxy must overwrite Host,
  X-Forwarded-Host, X-Forwarded-Proto and X-Forwarded-For with validated
  values; reject unrecognized public hosts. Set `AUTH_TRUST_HOST=true` only
  behind that trusted proxy.
- Generate distinct random secrets with `openssl rand -base64 32` for
  `AUTH_SECRET` and `ENCRYPTION_KEY`. Store them in an ignored file with
  mode 0600 or a runtime secret manager. Never put them in Docker build
  arguments, public client variables, logs, or source control.
- Verify a sender domain in Resend. Set `EMAIL_PROVIDER=resend`,
  `RESEND_API_KEY` to a restricted sending key, and `EMAIL_FROM` to a
  sender on that verified domain. The adapter sends over HTTPS and fails
  on rejected or malformed responses; it never falls back to console
  delivery. Provider health only indicates configuration, not delivery.
- The existing Auth.js production gate excludes the passwordless
  development credentials provider. Do not seed or use the demo user in
  staging. Use a real test mailbox and normal signup/sign-in.

### Acceptance test on the actual host

1. Start the staging stack, run migrations, and confirm healthy services.
2. Open the HTTPS sign-in page in a fresh browser session and confirm
   `/api/auth/providers` does not include `dev-login`.
3. Sign up or sign in with a non-demo test email. Confirm the real mailbox
   receives the magic link and that its origin is the exact HTTPS APP_URL.
   Do not paste the link into logs, tickets, or chat.
4. Open the link, confirm the authenticated session and workspace access,
   then sign out. Confirm reusing the same link fails and unauthenticated
   workspace requests are denied.
5. Confirm the session cookie uses Secure and HttpOnly. Verify that missing
   required secrets or console email mode prevent a staging startup.

Blocker: a staging host, DNS/TLS configuration, verified Resend sender and
live sending credentials are not available in this implementation session.
Unit tests use mocked HTTP; they do not certify delivery or live sign-in.
Do not mark the staging authentication acceptance test complete until a
real non-demo user signs in on that host.
