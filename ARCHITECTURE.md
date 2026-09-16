# ContentForge architecture

A modular monolith with three processes: Next.js owns authenticated UI/HTTP, the worker performs provider/workflow operations, and the renderer runs FFmpeg. PostgreSQL is the source of truth. Media storage is shared between processes. No Redis or message broker is required. [README](README.md) contains the architecture and agent diagrams.

## Execution

1. Routes resolve a non-deleted workspace, verify membership/RBAC and validate input with Zod.
2. Admission locks the workspace row, checks idempotency, subscription, recorded spend, rate and overlapping content production, then creates WorkflowRun and QueuedTask together.
3. Consumers reserve matching task types using `FOR UPDATE SKIP LOCKED`, explicit UTC timestamps, unique reservation tokens and renewable leases.
4. Typed handlers validate payloads, recheck ownership and the initiator's current role, execute operations and persist workflow steps, jobs, usage and outputs.
5. Fenced transactions reject stale reservations. Advancing completes the current task and enqueues its successor atomically. Completed steps are reused on retry.
6. The renderer uses persisted scene PNGs, caption text and audio to produce an MP4 and pending human review. Browsers poll persisted progress with reconnect backoff.
7. Approval/compliance permit scheduling. The publisher rechecks the latest review, subscription and destination at execution. Mock publishing persists a unique post and enqueues analytics.

## Boundaries

| Package   | Responsibility                                                                    |
| --------- | --------------------------------------------------------------------------------- |
| database  | Prisma schema/client, migration, seed, isolated test databases                    |
| ai        | Typed agents, official SDK adapters, router, bounded structured generation, mocks |
| workflows | Queue, executor, admission, persistence, generation/media/publish handlers        |
| media     | Local storage, signed URLs, captions, FFmpeg scene composition                    |
| social    | Capability discovery, functional mock, setup-required adapters                    |
| auth      | Auth.js sessions, workspace RBAC                                                  |
| billing   | Local plan/subscription enforcement, setup-required checkout contract             |
| shared    | Environment, errors, redacted logs, encryption, utilities                         |
| ui        | Existing React/Tailwind design system                                             |

## Decisions and limitations

- PostgreSQL lets queue/domain changes share a transaction and avoids another service. Delivery is **at least once**. Fencing protects database commits but cannot undo an external call already accepted before a crash. Universal exactly-once provider billing is not claimed.
- Strategy and ideation are separate reviewable operations. Selecting an idea starts scriptwriting, independent critique, at most two revisions and subsequent critiques. Rejected output remains available for human edits. Agents never approve publishing.
- Routing supports explicit default/requested provider, deadline, retryable-failure fallback and a process-local circuit breaker. Real errors never silently produce mock output. Repair usage is accumulated, including known usage on validation failure.
- Worker and renderer poll disjoint registries. The unauthenticated render HTTP endpoint was removed. Both retain read-only health endpoints and stop reserving work during shutdown.
- Polling handles one-way progress with less infrastructure than WebSockets. State survives refreshes and reconnects. It intentionally replaces the optional SSE approach.
- Editing invalidates prior approval. Scheduled/published content is not editable. Changes require another critique/render/review cycle.
- New production supports 9:16 short videos. Mock voice is a labeled reference tone. Real speech, transcription, stock search and expensive video APIs require additional adapters. Existing template metadata is preserved; no Remotion implementation is claimed.
- GCP Terraform and disabled deployment workflow remain scaffolding. Cloud Tasks/GCS adapters are not implemented. Current pollers require continuously running compute and shared storage; the prior Cloud Run Job scaffold is not a drop-in production deployment.

Generated image and video object keys include the byte checksum. A stale worker can leave an unreferenced file, but cannot overwrite a different artifact selected by a newer reservation. Retried rendering reuses an already persisted render output. Storage garbage collection remains an operational follow-up.

Background services run through `tsx` because shared workspace packages export TypeScript source. Their build scripts validate types; Next.js emits the web production bundle. Prebundling background services is an optional deployment optimization, not a runtime prerequisite.
