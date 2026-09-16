# Implementation report

## Implemented

- A durable PostgreSQL task queue with atomic reservation, scheduled dispatch, expiring leases, heartbeat renewal, reservation-token fencing, idempotency, bounded retries, final-attempt crash recovery, dead letters and cancellation.
- Independent web, worker and renderer processes execute a typed handler registry. Database task completion and downstream enqueue happen atomically.
- StrategyAgent, IdeationAgent, ScriptwriterAgent, BrandCriticAgent and RevisionAgent have distinct contracts and observable handoffs. Critic rejection permits at most two revisions. Structured JSON repair is independently capped at two attempts.
- Official pinned OpenAI Responses and Gemini Interactions text adapters, OpenAI image generation, provider routing/fallback, deadlines and process-level circuit state. No real provider silently falls back to mock.
- Mock PNG assets, WAV reference audio, scene-timed SRT/WebVTT and real FFmpeg MP4 compositing. Generated image/audio/video provenance includes provider, model, prompt, dimensions/duration, checksum, cost estimate, workflow and generation job.
- Brand creation/editing/archive; campaign creation/editing; strategy/idea actions; idea acceptance/rejection; script, scene and platform-copy editing; version snapshots and comments; persisted progress and cancellation.
- Human approval with compliance acknowledgment gates scheduled mock publishing. Analytics are persisted, filtered and deduplicated by post, with CSV export and recommendations that cite snapshot evidence.
- HMAC media downloads and byte ranges, bounded JSON bodies, DNS-pinned imports, scoped permissions, safe logging and practical spending guards.
- Seed media now exists on disk. Integration/browser harnesses use disposable PostgreSQL databases and temporary storage. CI runs integration and browser checks.

## Changed

Long-running generation moved out of HTTP handlers into persisted workflows. Shared business logic moved into packages/workflows so web and background services use the same implementation. packages/ai was divided into schemas, agents, orchestration, provider adapters, errors and usage accounting. The public UI and documentation now distinguish executable local behavior from external setup requirements. Mutation controls remain disabled until client handlers are attached, preventing lost clicks during hydration.

## Deleted

Removed the synchronous ideas-generation endpoint, acknowledge-only worker behavior, unauthenticated renderer execution endpoint, duplicated web-service implementations, the obsolete decorative ContentPreview component and unused package dependencies. Removed unused ANTHROPIC_API_KEY/anthropic selection scaffolding in favor of the requested OpenAI/Gemini adapters. Removed the unused RENDER_MAX_CONCURRENT setting; each service executes one task at a time and concurrency scales by process count. Replaced unsigned URLs described as signed with HMAC signatures. Local browser upload URL creation now fails explicitly because no upload endpoint exists. Retained the in-memory queue strictly for unit tests and retained the standalone gradient demo as a separate rendering example.

## Database changes

Migration: `packages/database/prisma/migrations/20260914190000_durable_workflows/migration.sql`.

- QueuedTask stores workspace/run ownership, payload, task type, idempotency key, status, schedule, reservation token, lease, attempts, limits, errors and terminal timestamps, with reservation/status indexes.
- WorkflowRun adds scoped idempotency, start/completion timestamps and error text.
- WorkflowStep adds agent/provider/model/validation details and retry/cancellation states.
- MediaAsset adds model, prompt, generation timestamp and workflow reference.
- ContentVersion stores workspace-scoped script snapshots and author/time.

Existing domain records remain authoritative. No development data was deleted. Tests apply all migrations to disposable databases. Apply `pnpm db:migrate` to the development/deployment database before running the changed application.

## New environment variables

| Variable                        | Requirement                                                |
| ------------------------------- | ---------------------------------------------------------- |
| OPENAI_TEXT_MODEL               | Required when OpenAI text or OpenAI fallback is selected   |
| GEMINI_API_KEY                  | Required when Gemini text or Gemini fallback is selected   |
| GEMINI_TEXT_MODEL               | Required when Gemini text or Gemini fallback is selected   |
| OPENAI_IMAGE_MODEL              | Required when OpenAI image generation is selected          |
| AI_FALLBACK_PROVIDER            | Optional; openai or gemini, with that provider's key/model |
| AI_TIMEOUT_MS                   | Optional; default 45000                                    |
| OPENAI_INPUT_CENTS_PER_MILLION  | Optional operator-supplied cost estimate                   |
| OPENAI_OUTPUT_CENTS_PER_MILLION | Optional operator-supplied cost estimate                   |
| GEMINI_INPUT_CENTS_PER_MILLION  | Optional operator-supplied cost estimate                   |
| GEMINI_OUTPUT_CENTS_PER_MILLION | Optional operator-supplied cost estimate                   |
| OPENAI_IMAGE_COST_CENTS         | Optional operator-supplied image cost estimate             |

Existing OPENAI_API_KEY is required only for OpenAI selection. Existing AI_TEXT_PROVIDER accepts mock, openai or gemini; configurations using the former anthropic placeholder must be updated. Existing QUEUE_PROVIDER now defaults to postgres; legacy local also selects PostgreSQL in executable services. Existing DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY and APP_URL remain core setup. All processes must share LOCAL_STORAGE_DIR. Existing worker/renderer ports are used by service scripts. Test-only AUTH_URL and NEXTAUTH_URL bind the disposable login callback to the test server and are set by the harness. No paid credentials are required for mocks.

## Tests

| Command                                    | Result                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile --offline` | Passed with the final dependency lockfile                                              |
| `pnpm format`                              | Passed; final formatting check recorded below                                          |
| `pnpm lint`                                | Passed, 13 tasks, zero warnings                                                        |
| `pnpm typecheck`                           | Passed, 13 tasks; repeated after final changes                                         |
| `pnpm exec turbo run test --force`         | Passed, 65 unit tests, 12 tasks, no cache; added critic regression verified separately |
| `pnpm test:integration`                    | Passed, 7 tests across two disposable PostgreSQL suites                                |
| `pnpm build`                               | Passed for web, worker and renderer                                                    |
| `pnpm test:e2e`                            | Final run pending                                                                      |
| `git diff --check`                         | Passed                                                                                 |

The browser command also builds its dependencies. Docker could not be run because Docker is not installed. Earlier baseline commands and environment failures are recorded in [the audit](implementation-audit.md). Initial sandbox executions could not spawn esbuild/Prisma/browser children; approved local execution was used. An overlapping root check encountered a Windows Prisma DLL lock, and early browser attempts exposed navigation/test timing issues that were corrected before rerunning. One full browser run passed seven checks but its production case was interrupted by a roughly 58-minute system pause; it is rerun separately below. SDK tests use mocked HTTP/client boundaries and never paid external calls.

## External setup still required

- OpenAI: API key, enabled text/image models, account billing and optional price estimates.
- Gemini: API key, enabled model, account quota/billing and optional price estimates.
- Social platforms: developer applications, OAuth credentials, permissions/app review and implementation/testing of real adapters. Only mock publishing is executable.
- Stripe: credentials, product/price mapping, checkout/webhook integration and lifecycle testing. The existing billing rules enforce local plan state; a key alone does not enable paid checkout.
- GCP: project, IAM/workload identity, state backend, secrets, networking, working cloud storage/dispatch adapters and deployment testing. Terraform remains scaffolding.
- DNS/domain: production domain, TLS, APP_URL and auth/callback configuration. Production email delivery and operational monitoring also require setup.

## Remaining limitations

New production renders one 9:16 short-video variant with static scene images and text/captions. Multiple visual template styles, advanced transitions/motion, selectable aspect ratios and natural speech are not implemented. Mock audio is an audible reference tone; mock analytics are deterministic fixtures. Generated captions use scene timing rather than real transcription. Browser uploads, binary/PDF ingestion and full cloud storage are incomplete.

Provider contract tests verify our adapters, not live account access. Cost figures are estimates; missing pricing is marked unknown in usage records. Admission uses recorded spend and does not reserve future charges or guarantee an exact ceiling under concurrent requests. Some external failures may incur charges without returning usage. Circuit state is per process. Non-generation rate limits remain process-local.

Dead letters are visible, but an administrative replay UI is not implemented. Users can start another eligible content generation after correcting the cause. Operational retention, backup recovery, key rotation, alerting and real cloud deployment need further work. Docker is unavailable locally, so container builds/Compose startup are not locally certified. No commit or push was made.

## Architecture decisions

PostgreSQL is the durable queue because the repository already depends on it; transactional reservation and enqueue avoid an extra broker and coordinate separate processes. Delivery is at least once, with database fencing/idempotency guarding side effects. External exactly-once behavior still depends on provider idempotency support.

Bounded revision gives the critic a real decision role while limiting latency and cost. Human review remains the final publishing gate. Provider routing keeps real failures visible and permits only explicitly configured real-provider fallback. Mocks remain explicit so a local demonstration never misrepresents paid generation, speech or external publication.
