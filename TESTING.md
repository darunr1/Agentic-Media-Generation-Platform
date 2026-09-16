# Verification

Run root checks sequentially, especially on Windows where active Prisma processes hold the query-engine DLL. Use pnpm install --frozen-lockfile, pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm test:integration, pnpm build, and pnpm test:e2e. The root E2E command depends on a build. Never run it against a development database: the checked-in harness creates a fresh embedded PostgreSQL instance and temporary media directory.

Unit tests cover agent contracts and bounded revisions, structured repair and cost accounting, official provider SDK boundaries with fake responses, routing failures and timeouts, queue state transitions and fencing, media signatures and captions, RBAC, billing, cryptography, social contracts and URL-import rejection. No provider test makes a paid call.

Integration tests migrate disposable PostgreSQL databases. Workflow tests exercise independent-client reservation, retry/dead-letter behavior, cancellation and a real FFmpeg production flow with approvals, mock scheduled publishing and analytics. Browser tests use separate web, worker and renderer processes on ports 3100-3102 and Chromium. The full production scenario runs once on desktop; public/navigation checks also run with a mobile viewport.

FFmpeg and fonts must be available. Restricted execution environments may block esbuild, PostgreSQL or browser child processes; run the same checks in an approved local execution context. Docker image/Compose verification requires Docker. Provider credentials and cloud deployment are verified separately by the operator; mocked contract tests are not live account certification.
