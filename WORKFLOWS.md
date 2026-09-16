# Workflow execution

Create a campaign, generate strategy, generate ideas and accept a short video idea. Production dispatches `generation.script` -> `generation.assets` -> `generation.voice` -> `generation.captions` -> `render.video`. ScriptwriterAgent, BrandCriticAgent and up to two RevisionAgent/critic rounds are separately persisted steps.

Rendering creates a pending review and AWAITING_REVIEW content. Human approval and compliance permit scheduling. `publish.content` becomes reservable when due, revalidates the gate, persists a mock post and enqueues `analytics.collect`.

Delivery is at least once. Tokens fence stale database writes; completed steps are reused; next-task enqueue and current completion are atomic. Retryable errors use bounded exponential backoff with jitter. Permanent/exhausted failures dead-letter and appear in the timeline. Cancellation invalidates tasks and propagates through heartbeats to abortable work. Shutdown stops reservations and allows in-flight work 25 seconds before aborting.

The browser polls `/api/v1/workspaces/:slug/workflows/:runId` with backoff. Failed content can be edited and submitted as a new workflow/key. A dedicated dead-letter replay/admin interface is not implemented.
