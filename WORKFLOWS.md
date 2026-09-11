# Workflows

ContentForge uses an explicit state machine, not an autonomous agent. Content progresses through `DRAFT → PLANNING → SCRIPTING → ASSET_GENERATION → VOICE_GENERATION → CAPTION_GENERATION → RENDERING → AWAITING_REVIEW → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED`. Changes, partial publication, failure, cancellation, retry, and dead-letter branches are explicit.

Each `WorkflowRun` owns ordered `WorkflowStep` records with inputs, outputs, idempotency keys, retries, cost, timestamps, and failure details. Provider calls create `GenerationJob` and `ProviderUsage` records. Retryable errors use bounded exponential backoff with jitter. Publishing is not blindly retried; the worker reconciles remote status using its idempotency key first. Cancellation is persisted and passed to local renders with `AbortSignal`.
