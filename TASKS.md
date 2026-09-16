# Implementation status

This checklist describes executable behavior, not the original roadmap. See docs/implementation-report.md for command results and limitations.

## Implemented

- [x] Repository audit and baseline checks before changes.
- [x] Durable PostgreSQL queue, transactional claims, leases, reservation fencing, retries, final-attempt crash recovery, dead letters, cancellation and graceful worker shutdown.
- [x] Typed task registry shared by independent worker and renderer processes.
- [x] Strategy, ideation, scriptwriter, brand critic and bounded revision agents with validated outputs and persisted activity.
- [x] Optional official OpenAI and Gemini text SDK adapters; explicit routing, retry classification, deadlines and circuit breaker.
- [x] Optional OpenAI images, deterministic mock PNGs, mock WAV reference audio, scene-timed SRT/WebVTT.
- [x] FFmpeg scene compositing with assets, burned text/captions and audio into playable 9:16 MP4.
- [x] Brand create/edit/archive, campaign create/edit, generation actions, idea accept/reject, script/platform-copy editing, version history, comments and review actions.
- [x] Persisted workflow timeline, polling recovery, retry/error details, provider/usage display and cancellation.
- [x] Latest-review and compliance approval gate, durable scheduled mock publishing, duplicate prevention and analytics collection.
- [x] Analytics date/platform/content filters, cumulative-snapshot deduplication, evidence-backed observations and CSV export.
- [x] HMAC download URLs with video ranges, storage containment, DNS-pinned URL imports, bounded generation and redacted error logging.
- [x] Seed generates actual local fixture media; clean isolated PostgreSQL integration and browser harness.
- [x] CI executes unit, integration, build and browser checks; documentation corrected to current behavior.

## Still requires implementation or external setup

- [ ] Natural speech TTS, transcription, generated video and binary/PDF knowledge import.
- [ ] Full browser asset uploads, GCS storage and Cloud Tasks adapters.
- [ ] Distinct visual render templates, motion/transitions and selectable multi-ratio production variants. Seeded examples can have multiple ratios; new production is 9:16.
- [ ] Real social OAuth/publishing/analytics integrations and platform approval.
- [ ] Stripe checkout/webhook lifecycle and production email delivery beyond existing contracts/helpers.
- [ ] GCP deployment, DNS/TLS, secrets, monitoring, retention, recovery drills and production authentication configuration.
- [ ] Administrative dead-letter replay UI; users can start another eligible content generation with a new key after correcting the cause.
- [ ] Distributed rate limiting outside generation admission, cost reservation/reconciliation and rich semantic compliance guarantees.
