# TASKS.md — Live Build Checklist

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked
(external secret/account/approval needed — see note).

This file is updated at the end of every phase per the engagement brief. It
is the single source of truth for "what's actually built" — README/docs
summarize, this file tracks ground truth.

## Phase 0 — Planning

- [x] Inspect repository (empty except README)
- [x] Confirm no Docker/Postgres available locally → documented fallback
      (`embedded-postgres` for sandbox verification only)
- [x] PRODUCT_REQUIREMENTS.md
- [x] ARCHITECTURE.md (with Mermaid diagrams + ADR log)
- [x] TASKS.md (this file)
- [x] DATA_MODEL.md (conceptual — schema.prisma is source of truth, written in Phase 1)

## Phase 1 — Foundation

- [x] pnpm workspace + Turborepo config
- [x] packages/config (tsconfig base/nextjs/node, eslint flat config, prettier, tailwind preset)
- [x] packages/shared (env loader+validation, error types, ids, pagination, logger, crypto helpers, zod primitives)
- [x] packages/database (Prisma schema — full model set, migrations, seed)
- [x] packages/auth (Auth.js config, workspace/session helpers, RBAC guard)
- [x] apps/web skeleton (App Router, layout, providers, Tailwind, design tokens)
- [x] packages/ui design system primitives (button, input, card, badge, dialog, toast, skeleton, etc.)
- [x] Docker Compose (postgres, web, worker, renderer, adminer)
- [x] Root scripts: dev/build/lint/typecheck/test/format
- [x] Seed data script runs and produces the fixtures in DATA_MODEL.md §5
- [x] Public pages: landing, features, pricing, sign-in, sign-up, privacy, terms
- [x] Workspace switcher + onboarding shell

## Phase 2 — Brand onboarding

- [~] Brand profile CRUD (list/create API and schemas complete; update/delete UI flow remains)
- [~] Brand onboarding wizard UI (guided sections are present; persistence is API-driven)
- [~] BrandAsset upload (local signed-style URLs, magic-byte validation, and limits; GCS adapter remains)
- [~] KnowledgeSource ingestion: manual text and URL are implemented; binary/PDF import remains
- [x] URL importer SSRF defenses (private-IP block, timeout, max size, script stripping, robots respect)
- [x] BrandContext builder (assembles brand + guidelines + knowledge chunks into a typed object generation reads)
- [x] Brand assets & knowledge sources pages in UI

## Phase 3 — Content planning

- [~] Campaign CRUD + content pillar model (list/create API and complete model)
- [x] packages/ai: TextGenerationProvider + EmbeddingProvider interfaces, MockTextGenerationProvider, MockEmbeddingProvider
- [x] Structured-output validation + schema-repair-retry loop
- [~] Strategy generation step (typed contract and seeded result; dedicated endpoint remains)
- [x] Idea generation step (5 ideas, full typed fields from brief §7B)
- [~] Idea board UI (complete read experience; interactive accept action remains)

## Phase 4 — Content production

- [~] Script generation (typed schema and seeded output; dedicated endpoint remains)
- [~] Scene planning (typed schema and seeded output; dedicated endpoint remains)
- [~] MediaAsset selection/generation (provider contracts and deterministic generated backgrounds)
- [~] Voice generation (TTS contract is complete; local audio synthesis remains)
- [x] Caption generation (SRT + WebVTT) + TranscriptionProvider mock
- [~] Local rendering pipeline (safe FFmpeg pipeline complete; Remotion compositing remains)
- [x] 3 render templates: educational list, myth-vs-fact, promotional offer
- [~] 9:16 / 1:1 / 16:9 output variants are modeled; thumbnail generation remains
- [x] Render progress reporting + cancellation + timeout + temp-file cleanup
- [~] Content studio UI (full read/preview experience; interactive editors remain)

## Phase 5 — Workflow orchestration

- [~] WorkflowRun/WorkflowStep persisted model plus tested transition state machine
- [~] TaskQueueProvider interface and local in-memory queue; Postgres and Cloud Tasks adapters remain
- [x] Retry policy (exponential backoff + jitter, retry classification per provider)
- [x] Idempotency keys on generation/render/publish
- [~] Dead-letter state is modeled; admin retry action remains
- [x] Cancellation in the queue and renderer
- [x] Cost/usage tracking (ProviderUsage rows, per-workflow rollup)
- [~] apps/worker process (consumer shell and execution boundary)
- [~] Workflow progress is shown in seeded product views; dedicated run detail remains

## Phase 6 — Review

- [x] ApprovalRequest/ApprovalDecision models + service
- [x] Approval queue UI
- [x] Content preview (video/image/text)
- [~] Approve / Reject / Changes-requested API; approve-and-schedule is a separate publish call
- [~] ContentComment model supports scene scope; interactive comment UI remains
- [~] Version records are modeled; before/after comparison UI remains
- [ ] External client approval link (signed, expiring JWT-style token, no login required)
- [x] Publish-blocking guard (unapproved / missing assets / expired connection / inactive subscription / over usage limit / missing compliance ack / invalid schedule / duplicate idempotency key)

## Phase 7 — Publishing

- [x] SocialPlatformProvider interface (all methods from brief §10)
- [x] Mock adapter (fully functional, drives entire demo)
- [~] Instagram typed setup-required adapter; provider-specific OAuth exchange remains
- [~] YouTube typed setup-required adapter; provider-specific OAuth exchange remains
- [x] Facebook/Threads/TikTok/X — typed documented stubs, capability discovery marks them unsupported in UI
- [~] Scheduling (PublishJob persistence and validation; production dispatcher remains)
- [ ] Webhook handlers (signature verification, replay protection, idempotent processing, raw+redacted retention) — Stripe + Instagram/mock
- [~] Social connections UI (status/expiry and explicit setup-required states; connect actions remain)
- [x] Publishing audit trail

## Phase 8 — Analytics

- [~] AnalyticsSnapshot normalized model, seeded snapshots, and adapter hooks; recurring collector remains
- [~] Analytics overview and top content are implemented; remaining breakdown views remain
- [ ] Date-range filtering + CSV export
- [~] Seeded evidence-based recommendation labeled as a hypothesis; automated engine remains

## Phase 9 — Billing

- [ ] Stripe integration (checkout, customer portal, webhooks)
- [x] Plan/UsageLimit/UsageEvent data model + enforcement middleware
- [ ] Trial support, failed-payment handling, admin override
- [~] Billing UI (current plan, trial, usage, and spend safeguards; checkout/invoices remain)
- [!] Live Stripe account/keys and the production SDK adapter are required; the UI clearly shows the setup-required state

## Phase 10 — Infrastructure

- [x] Dockerfiles (web, worker, renderer)
- [x] docker-compose.yml (local)
- [x] Terraform (Cloud Run services, Cloud Run Jobs, Cloud SQL, GCS, Cloud Tasks queues, Cloud Scheduler, Artifact Registry, Secret Manager references)
- [x] GitHub Actions CI (lint, typecheck, unit+integration tests, build, docker build, migration validation)
- [!] GitHub Actions CD (deploy workflow) — written but disabled (`if: false`) until GCP project/secrets exist

## Phase 11 — Quality

- [x] Vitest unit tests across packages
- [x] Vitest integration tests (embedded-postgres) for services with DB access
- [x] Playwright e2e covering the demo flow
- [ ] Contract tests for provider adapters (mock adapters conform to interface contract suite)
- [ ] Accessibility pass (axe checks in Playwright, focus/contrast review)
- [x] SECURITY.md + threat model
- [ ] Dependency review (no unused/unnecessary deps)
- [ ] Docs match implementation pass

## Acceptance criteria (brief §20) — status

- [x] `pnpm install` succeeds
- [ ] Docker Compose file starts required local services (cannot execute `docker compose up` in this sandbox — see PRODUCT_REQUIREMENTS.md §9; config will be validated by inspection + CI)
- [x] Database migrations succeed (verified via embedded-postgres in this sandbox; real Postgres via Docker Compose is the supported path)
- [x] Database seeding succeeds
- [x] `pnpm dev` starts the application
- [x] Seeded login works
- [x] Workspace authorization enforced
- [x] Demo workflow functions end-to-end
- [x] Real local MP4 rendered
- [x] Mock post scheduled and published
- [x] Duplicate publishing prevented (DB constraint + service check)
- [x] Usage recorded
- [x] Costs recorded
- [x] Critical unit tests pass
- [x] Critical Playwright tests pass
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm test` passes
- [x] `pnpm build` passes
- [x] Documentation matches implementation
- [x] No secrets committed
- [x] No placeholder page falsely appears complete (unimplemented = explicit "Setup required" state)
- [x] Unsupported integrations clearly marked

## Explicitly out-of-scope / needs external action

- [!] Real Stripe checkout/webhooks require a Stripe account, keys, and the production SDK adapter; the current build uses a typed setup-required adapter and enforces plans locally
- [!] Real Instagram/Facebook/TikTok/YouTube/X OAuth requires provider-specific adapters, developer app registration, and platform review; typed setup-required adapters are present
- [!] GCP project creation + `terraform apply` + `gcloud` deploy (IaC written, not applied — no cloud credentials in this environment)
- [!] Real domain/DNS/TLS for production deployment
