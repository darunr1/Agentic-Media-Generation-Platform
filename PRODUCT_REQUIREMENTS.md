# ContentForge — Product Requirements

> This is the product roadmap. Executable scope and remaining work are recorded in [TASKS.md](TASKS.md). The current release uses mock social publishing, local storage and a PostgreSQL queue; real platform APIs, cloud adapters and paid billing flows are future integrations.

## 1. Summary

ContentForge is a multi-tenant, service-assisted AI content generation and
publishing platform for small businesses. A business supplies a structured
brand profile; the platform turns that profile into a monthly content
strategy, generates scripts/scenes/captions, renders platform-specific
video/image assets, routes everything through a mandatory human approval
queue, schedules and publishes approved content through official platform
APIs, and feeds analytics back into future recommendations.

This document is the canonical requirements reference. It is derived from the
original engagement brief and is compared with current implementation — see [TASKS.md](TASKS.md) for current build status of each
requirement.

## 2. Non-goals / explicit prohibitions

ContentForge will **never** implement:

- Fake engagement (bot likes/comments/follows), account farming
- Platform scraping or CAPTCHA bypass
- Browser-automation-based credential capture (no headless-browser "logins")
- Guaranteed-revenue claims or other deceptive marketing patterns
- Autonomous, unbounded agents making irreversible external calls — all
  generation and publishing flows through a deterministic, persisted
  workflow/state machine (see [WORKFLOWS.md](WORKFLOWS.md))

Only official platform OAuth + REST/Graph APIs are used for publishing.

## 3. Personas & roles

| Role     | Capability summary                                                                           |
| -------- | -------------------------------------------------------------------------------------------- |
| OWNER    | Full control of a workspace, billing, team, deletion                                         |
| ADMIN    | Full operational control, no billing/workspace-deletion                                      |
| EDITOR   | Create/edit brand, campaigns, content; cannot approve own work for publishing gate purposes* |
| REVIEWER | Approve/reject content, comment, cannot create generation jobs                               |
| VIEWER   | Read-only access to content, calendar, analytics                                             |

\* Editors _can_ be granted approval rights per workspace policy; the default
posture is separation of duties but is not hard-coded as mandatory 4-eyes
review, since single-person small businesses are the primary target market.

Agency plan adds multi-workspace membership (a user belongs to N workspaces)
and client-facing external approval links that do not require an account.

## 4. Plans

| Feature                 | Starter  | Growth   | Agency                     |
| ----------------------- | -------- | -------- | -------------------------- |
| Brands                  | 1        | 1        | Many (client workspaces)   |
| Content items / month   | 12       | 30       | Configurable per workspace |
| Social connections      | 1        | Multiple | Multiple per workspace     |
| Analytics               | —        | ✔        | ✔                          |
| Content calendar        | Basic    | ✔        | ✔                          |
| Custom render templates | —        | ✔        | ✔                          |
| Rendering priority      | Standard | Priority | Priority                   |
| Team members            | 1        | Up to 3  | Unlimited (seat-based)     |
| Client approval links   | —        | —        | ✔                          |
| Usage reporting         | Basic    | ✔        | Per-client                 |

Plans and limits are data (`Plan`, `UsageLimit` tables), not hard-coded
constants, so pricing/limits can change without a deploy.

## 5. Required content formats

9:16 short video, 1:1 feed post, 4:5 feed post, 16:9 video, text-only post,
threads (multi-post text sequences), carousels (ordered image/text sets),
caption/hashtag variation sets per platform.

## 6. Core user journey (must work end-to-end locally, no paid API keys)

1. Sign in as seeded demo user.
2. Open the seeded workspace/business.
3. Review its brand profile.
4. Create a campaign.
5. Generate 5 content ideas via the mock AI provider.
6. Pick an educational short-form-video idea.
7. Generate script + scenes.
8. Render a real, playable 15–30s MP4 locally (FFmpeg/Remotion).
9. Preview the video.
10. Edit the caption.
11. Submit for review.
12. Approve.
13. Schedule.
14. Publish via the mock social adapter.
15. View the published-post record.
16. View seeded analytics.
17. See a generated recommendation.
18. Review usage & estimated cost.
19. Review the corresponding audit-log entries.

This is the acceptance-test backbone for every phase below — see
[docs/demo-script.md](docs/demo-script.md).

## 7. Functional requirements by domain

See [ARCHITECTURE.md](ARCHITECTURE.md) for the domain boundaries and
[DATA_MODEL.md](DATA_MODEL.md) for the schema that backs each domain. Detailed
functional requirements for generation, media, review, publishing, analytics
and billing are captured in the corresponding docs: [WORKFLOWS.md](WORKFLOWS.md),
[PROVIDERS.md](PROVIDERS.md), [SOCIAL_INTEGRATIONS.md](SOCIAL_INTEGRATIONS.md).

## 8. Explicit acceptance criteria

See section 20 of the original brief, reproduced and tracked as checklist
items in [TASKS.md](TASKS.md#acceptance-criteria).

## 9. Known environment constraint

The development sandbox this project was built in has **no Docker Desktop and
no local PostgreSQL server** available (verified during Phase 0 — see
ARCHITECTURE.md §"Local verification strategy"). `docker-compose.yml`,
Dockerfiles and CI Postgres services are still written to the real
requirement and are the _documented, supported_ path for any normal
developer machine or GitHub Actions runner. Local verification inside this
particular sandbox uses an ephemeral, non-service embedded Postgres binary
(`embedded-postgres` dev dependency) purely so migrations/seed/tests can be
exercised without installing anything system-wide. This is called out again
in [README.md](README.md#known-limitations).
