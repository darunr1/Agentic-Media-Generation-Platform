# Testing

Vitest covers domain rules, provider contracts, encryption, permissions, structured output, captions, workflow transitions, retries/circuits, social idempotency, and billing. Database tests use isolated PostgreSQL where supported. Playwright owns sign-in, tenant isolation, generation, review, scheduling, mock publishing, analytics, and accessibility smoke flows.

Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Use `pnpm test:integration` with process/network permission and `pnpm test:e2e` after seeding. CI runs PostgreSQL 16 and builds all service images.
