# Provider contracts

External services never leak vendor response types into domain logic. Typed contracts cover text generation, embeddings, image/video generation, speech, transcription, object storage, task queues, email, analytics, and social platforms. Results include normalized usage/cost data and providers expose configuration validation and health status.

Local defaults are deterministic mock text/embedding, generated gradient media, optional placeholder voice, local disk storage, local queue, console email, and mock publishing. Structured AI output is validated with Zod; invalid output receives at most two schema-repair attempts before failure is persisted and surfaced. Vendor adapters must normalize errors, declare retryability, apply deadlines, redact secrets, and pass contract tests.
