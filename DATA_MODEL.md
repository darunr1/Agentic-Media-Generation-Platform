# ContentForge — Data Model

The Prisma schema at `packages/database/prisma/schema.prisma` is the source of
truth; this document explains the _why_ behind the grouping and the
relationships that are easy to miss when reading the raw schema. Regenerate
your mental model from the schema file if this document and the schema ever
disagree — treat that as a bug and fix the doc.

## 1. Conventions

- **IDs**: `cuid()` everywhere (sortable-ish, collision-resistant, no
  round-trip to the DB needed before referencing a new row from application
  code).
- **Timestamps**: every model has `createdAt` (`@default(now())`) and
  `updatedAt` (`@updatedAt`).
- **Soft delete**: workspace-owned, user-visible models carry a nullable
  `deletedAt`; queries go through repository helpers that filter it out by
  default. Join/audit/event/log tables are hard-delete-only (or immutable).
- **Workspace isolation**: every tenant-owned model has a direct
  `workspaceId` foreign key (denormalized even where it could be reached
  through a parent) so every query can filter on it directly and every unique
  constraint that must be per-tenant is `@@unique([workspaceId, ...])`.
  This is the primary defense against IDOR/broken-isolation bugs — services
  never trust a bare `id` from the client without also matching
  `workspaceId` from the authenticated session.
- **Encrypted token metadata**: OAuth tokens are stored as
  `encryptedAccessToken`/`encryptedRefreshToken` (`Bytes`, AES-256-GCM via
  `packages/shared/src/crypto`) plus `tokenExpiresAt`; the Prisma model never
  has a plaintext `accessToken` column, so there's no code path in which one
  could accidentally leak through a Prisma `select: { *: true }`.
- **Idempotency**: any model created as the result of a retryable action gets
  a unique `idempotencyKey` (scoped to workspace) — `GenerationJob`,
  `RenderJob`, `PublishJob`.

## 2. Entity groups

### Identity & workspace

`User`, `Account`, `Session` (Auth.js adapter models) → `WorkspaceMembership`
(join table carrying `role: WorkspaceRole`) → `Workspace`. `Invitation`
carries a hashed token + expiry for email-based team invites.

### Brand knowledge

`Brand` (one row per business; `Workspace` can have more than one only on the
Agency plan, enforced in the service layer, not the schema, since limits are
plan data) has one `BrandVoice`, many `BrandGuideline` (prohibited
claims/compliance notes), many `BrandAsset` (logos/photos/video clips —
metadata only; bytes live in object storage), many `KnowledgeSource` (raw
ingested document/URL, `sourceType` enum) each producing many `KnowledgeChunk`
(chunked + embedded text, `pgvector` column) used for retrieval when building
a `BrandContext`.

### Planning

`Campaign` (belongs to `Brand`) → many `ContentPillar` → many `ContentIdea`.
An accepted `ContentIdea` becomes a `ContentItem` (the unit that moves through
the workflow state machine) which can have multiple `ContentVariant` rows
(one per target platform/aspect ratio — this is how one idea becomes a 9:16
TikTok cut _and_ a 1:1 Instagram cut without duplicating the idea).

### Production

`ContentVariant` → one `Script` → many `Scene` (typed scene schema: timing,
narration, on-screen text, visual prompt, transition, asset type). Scenes
reference `MediaAsset` rows (uploaded or provider-generated media, with
provider/cost metadata). `VoiceTrack` and `CaptionTrack` attach to a `Script`.
`RenderTemplate` (educational-list / myth-vs-fact / promotional-offer, etc.)

- `RenderJob` (one execution) → `RenderedAsset` (the output file reference,
  one row per aspect-ratio output of a single render job).

### Orchestration

`GenerationJob` wraps a single AI-provider call (strategy/idea/script/scene
generation) with cost/token tracking and a link to the owning `WorkflowRun`.
`WorkflowRun` + `WorkflowStep` are the persisted state machine described in
[WORKFLOWS.md](WORKFLOWS.md); every `RenderJob`/`GenerationJob`/`PublishJob`
belongs to exactly one `WorkflowStep`.

### Review

`ApprovalRequest` (one per `ContentItem` review cycle) → many
`ApprovalDecision` (approve/reject/changes-requested, reviewer identity,
timestamp) and many `ContentComment` (scene- or field-scoped change
requests). External client review uses a signed, expiring token stored on
`ApprovalRequest.externalToken*` fields rather than a separate table.

### Publishing

`SocialConnection` (one OAuth grant, workspace-owned) → many `SocialAccount`
(a connection can expose multiple pages/channels). `PublishJob` (one attempt
to publish one `ContentVariant` to one `SocialAccount`, unique on
`[contentVariantId, socialAccountId]` to make duplicate publishing a database
constraint, not just an application check) → `PublishedPost` (the resulting
external post reference + a `PostAnalyticsSnapshot`-feeding relation).

### Analytics

`AnalyticsSnapshot` — one row per `(publishedPostId, capturedAt)`, normalized
metric columns (nullable — a platform that doesn't expose a metric leaves it
null rather than a fabricated 0).

### Billing

`Plan` (data-defined plan catalog), `Subscription` (workspace ↔ Stripe
customer/subscription), `UsageLimit` (per-workspace effective limits, can be
admin-overridden independent of `Plan` defaults), `UsageEvent` (append-only
metering events — one per content-item generated, per render-minute, etc.).

### Cross-cutting

`Notification` (in-app + email dispatch record), `WebhookEvent` (raw event
retention with redaction + processing status, used by both Stripe and social
platform webhook handlers), `AuditLog` (append-only, actor + action + target

- diff), `ApiKey` (workspace-scoped API keys, hashed at rest),
  `FeatureFlag` (workspace or global boolean/variant flags).

## 3. Referential integrity & cascade policy

- Deleting a `Workspace` cascades to everything workspace-owned (only ever
  triggered by the explicit, confirmed account/workspace deletion workflow —
  never a side effect of another operation).
- Deleting a `Brand`/`Campaign`/`ContentItem` is soft (sets `deletedAt`);
  hard-delete is a scheduled job that runs after the deletion grace period
  and also removes the corresponding object-storage files.
- `onDelete: Restrict` is used wherever a child record's existence is
  evidence (e.g. you cannot delete a `SocialAccount` that has
  `PublishedPost` rows — you must revoke/deactivate instead), so financial
  and publishing history is never silently destroyed by a cascade.

## 4. Indexes worth calling out

- `@@index([workspaceId, status])` on `ContentItem`, `WorkflowRun`,
  `RenderJob`, `PublishJob` — every list/queue view filters by workspace +
  status.
- `@@index([workspaceId, scheduledAt])` on `ContentItem`/`PublishJob` for the
  content calendar.
- `@@unique([workspaceId, idempotencyKey])` on `GenerationJob`, `RenderJob`,
  `PublishJob`.
- `@@unique([contentVariantId, socialAccountId])` on `PublishJob` — the
  database-level duplicate-publish guard.
- `KnowledgeChunk.embedding` uses `pgvector`'s `vector` type with an `ivfflat`
  index for similarity search (guarded by a runtime capability check; if the
  `vector` extension is unavailable the app degrades to keyword search rather
  than failing startup).

## 5. Seed data

`packages/database/prisma/seed.ts` creates the fixtures the
[demo flow](docs/demo-script.md) needs: one demo user/workspace, a fictional
local business ("Riverbend Coffee Roasters") with a complete brand profile,
one campaign with content pillars, five content ideas, one content item
carried all the way through script/scenes/render to an
`AWAITING_REVIEW`→`APPROVED` state, one `SCHEDULED` post, one mock
`PUBLISHED` post with `AnalyticsSnapshot` rows, and a `TRIALING` Starter
subscription.

It is built up **incrementally, phase by phase**, rather than all at once in
Phase 1 — each phase's slice of `seed.ts` is written using that phase's own
real services (e.g. the Phase 4 render fixture calls the actual FFmpeg
render function to produce a real MP4 into local storage, not a fabricated
`RenderedAsset` row pointing at a file that doesn't exist). This keeps seed
data indistinguishable from what a user generates interactively, at the cost
of the seed script only reaching its full brief-§5 shape once Phase 8 lands.
`TASKS.md` tracks which slice is live at any point.
