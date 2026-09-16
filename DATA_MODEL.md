# ContentForge data model

[The Prisma schema](packages/database/prisma/schema.prisma) is authoritative. Most tenant entities carry workspaceId; nested scenes/tracks are authorized through their content variant/item. Every user-supplied ID requires an ownership check. Normal workflows exclude soft-deleted entities.

| Domain        | Models                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Identity      | User, Workspace, WorkspaceMembership, Invitation, Auth.js accounts/sessions                                |
| Brand         | Brand, BrandVoice, BrandGuideline, BrandAsset, KnowledgeSource, KnowledgeChunk                             |
| Planning      | Campaign with strategy JSON, ContentPillar, ContentIdea                                                    |
| Production    | ContentItem, ContentVariant, Script, Scene, VoiceTrack, CaptionTrack, MediaAsset, RenderJob, RenderedAsset |
| Orchestration | WorkflowRun, WorkflowStep, QueuedTask, GenerationJob, ProviderUsage                                        |
| Review        | ApprovalRequest, ApprovalDecision, ContentComment, ContentVersion                                          |
| Publishing    | SocialConnection, SocialAccount, PublishJob, PublishedPost, AnalyticsSnapshot                              |
| Billing       | Plan, Subscription, UsageLimit, UsageEvent                                                                 |
| Cross-cutting | AuditLog, Notification, WebhookEvent, ApiKey, FeatureFlag                                                  |

## Migration: 20260914190000_durable_workflows

- QueuedTask adds tenant/run identity, typed task name, JSON payload, idempotency key, six durable states, scheduling/reservation/completion/failure timestamps, attempt budget, safe error, fenced reservation token and lease expiration. Indexed for ready and expired-lease scans.
- WorkflowRun adds idempotency, start/completion timestamps and safe error. WorkflowStep adds agent/provider/model, validation, RETRYING and CANCELLED.
- MediaAsset adds model, safe prompt, generation timestamp and workflow reference alongside its existing MIME, dimensions, duration, checksum, provider/cost and generation-job fields.
- ContentVersion stores immutable script snapshots indexed by workspace/content/time.

Successful step output includes structured data and usage reports. Some denormalized references remain strings rather than foreign keys; services verify their relationship and ownership. Deleting a workflow cascades to its queue tasks.

Workspace/idempotency uniqueness protects workflow/generation/render/publish requests. PublishJob also has unique content-variant/account identity. An accepted idea can have only one content item. AnalyticsSnapshot has unique post/capture time; views select the latest cumulative snapshot per post rather than adding repeated lifetime counts.

Knowledge embeddings currently use PostgreSQL float arrays. **pgvector and semantic vector search are not implemented.** Webhook and external-review token fields do not imply implemented product routes.

The Riverbend seed supplies brand/planning/review/publishing/analytics fixtures and renders missing local videos/captions/audio, updating metadata to actual bytes. Mock audio is a reference tone. Seed workflow history is illustrative; newly generated workflows record actual execution.
