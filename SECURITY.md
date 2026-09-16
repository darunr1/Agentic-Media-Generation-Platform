# Security boundaries

All new workspace routes resolve the tenant and require membership plus the relevant RBAC permission. Worker tasks recheck the initiating membership. Generation admission is serialized per workspace in PostgreSQL and checks plan status, recorded monthly spend, per-content attempts and a ten-workflows-per-minute limit. This is an admission guard, not a reservation of future provider charges; concurrent in-flight requests can exceed an estimated budget. Other API rate limits remain process-local.

Queue claims use row locks, expiring leases and random reservation tokens. Database writes verify the active lease inside the same transaction; cancellation fences stale workers. Stored workflow inputs and model outputs are visible to workspace members. Avoid putting secrets in brand knowledge or prompts. Provider exception logs retain safe categories rather than arbitrary SDK objects.

Local download URLs use HMAC-SHA256 over method, key and expiry with AUTH_SECRET, constant-time signature comparison and bounded expiry. They are bearer capabilities: anyone with the unexpired link can read the file. Keys are constrained to the configured storage root. The GET route supports byte ranges. Upload helpers are not a complete user upload service. Production needs private object storage, access logging, retention rules and malware scanning.

Web imports reject private/reserved IPv4 and IPv6 addresses, pin the HTTP connection to a validated DNS result, revalidate redirects, and cap bytes, time and redirect count. HTML is stripped before storage and knowledge is identified as untrusted reference data in agent prompts. Robots handling is basic and not a substitute for a site's permission or terms. Binary/PDF ingestion remains unavailable.

Rendering uses bounded dimensions, duration, scene count, a subprocess argument array, fixed temporary filenames, abort deadlines and cleanup. AI output is validated with Zod; invalid structured output gets at most two repairs. Brand review gets at most two revisions. Neither model review nor deterministic checks replace human compliance review.

Publishing requires the latest approved review, compliance acknowledgment, an active plan and an eligible connection. Only the explicit mock social adapter is executable. Existing token encryption and webhook-verification utilities do not imply real OAuth refresh or webhook integrations are complete. Production deletion, key rotation, backup restoration, operational alerting and incident response need deployment-specific implementation and verification.
