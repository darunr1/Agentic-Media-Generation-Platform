# Security and threat model

## Trust boundaries

Browsers, uploads, imported webpages, AI output, webhooks, OAuth callbacks, and provider responses are untrusted. Routes validate with Zod, resolve the route workspace, and assert membership plus named RBAC permission before tenant queries or mutations.

## Controls

- Auth.js sessions, CSRF-safe auth flows, secure headers/CSP, React output escaping, and no production stack traces.
- File-size and magic-byte checks, sanitized names, controlled storage keys, signed URLs, media deadlines, and FFmpeg argument arrays without a shell.
- URL imports reject private/reserved addresses, cap redirects/bytes/time, respect robots, strip active markup, and label source text as data—not instructions.
- OAuth credentials use AES-GCM authenticated encryption, minimal scopes, server-only access, expiry/refresh/revocation, and redacted logs.
- Webhooks require signatures, a five-minute replay window, unique event IDs, redacted raw retention, and idempotent processing.
- Workspace budgets, plan limits, job caps, concurrency controls, cancellation, bounded retries, circuit breakers, and dead letters constrain cost and availability abuse.
- Human approval and compliance acknowledgment are mandatory; database uniqueness prevents duplicate publishing.

Residual risk remains around malicious media scanning, operational key rotation, and differing platform metric definitions. Report vulnerabilities privately without including secrets in public issues.

Deletion is staged: re-authenticate an owner, revoke tokens, cancel jobs, soft-delete tenant data, delete storage objects, expire credentials, retain only legally required records, and audit completion.
