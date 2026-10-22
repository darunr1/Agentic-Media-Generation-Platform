# ContentForge: Product Requirements Document

**Status:** Draft for review  
**Version:** 0.1 (private beta)  
**Updated:** October 20, 2026  
**Project:** [Agentic Media Generation Platform](https://github.com/darunr1/Agentic-Media-Generation-Platform)  
**Project owners:** Darun and Teju

> This PRD defines the next practical release of ContentForge. [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) remains the broader long-term specification, while [TASKS.md](TASKS.md) tracks what the code already implements. Requirements below marked **Planned** are not shipped features.

## 1. Product overview

ContentForge helps small businesses create short-form marketing videos without writing every script, finding every visual, or editing everything manually. A user sets up a brand, creates a campaign, chooses an idea, and uses a guided workflow to generate a script, visual scenes, narration, captions, and an MP4. A person reviews the content before using it.

The first private beta should focus on a narrow, complete outcome: **generate, preview, approve, and download a useful 9:16 marketing video with real spoken narration and captions**. Users can post the exported file themselves. Automatic publication to external social platforms is not required for the beta.

## 2. Problem and opportunity

Local businesses need content for social media but often lack time, editing experience, and consistent creative direction. Tools that produce disconnected scripts or assets still leave the user to assemble a usable final video. ContentForge aims to make that process one guided workflow while preserving the business owner's control over final messaging.

For the first release, success is not the number of AI agents or integrations. Success is whether a real user can complete a useful video without developer assistance.

## 3. Target users

| Persona | Need | First-beta job to be done |
| --- | --- | --- |
| Small-business owner | Create marketing content with limited time | Turn a business idea into a ready-to-download short video |
| Student founder or solo marketer | Produce consistent social content with minimal tools | Generate and refine a video without separate script and editing apps |
| Small agency operator (later) | Manage several brands and approvals | Use separate workspaces and review activity; agency-scale workflows can follow |

Primary pilot audience: local service businesses, cafés, restaurants, and student-run businesses. The team should validate which segment gets the most value rather than trying to serve every industry at launch.

## 4. Goals and success measures

These are proposed targets for the first private beta, not current results.

| Goal | Proposed success measure |
| --- | --- |
| Deliver an end-to-end narrated video | Generate an MP4 with audible speech and readable captions in the staging environment |
| Make the workflow approachable | At least 3 external testers attempt the workflow without a developer operating the UI |
| Prove repeated use | At least 2 successful exports per tester, for 6 total pilot exports |
| Establish baseline reliability | At least 80% of pilot generation attempts complete successfully; report the actual denominator |
| Gather useful product feedback | Record completion problems, perceived video quality, and willingness to use again from each tester |
| Keep operations manageable | Document setup, service restart, backup/restore, and per-generation provider spend where known |

Measure time from starting a campaign to first playable video, and separately measure time spent waiting for generation. Do not promise a fixed rendering speed before measuring it.

## 5. Existing product baseline

The current main branch and repository documentation indicate:

| Area | Current status |
| --- | --- |
| Web application and workspace model | **Implemented:** Next.js, authentication, workspace roles, brand and campaign pages |
| Content strategy and ideation | **Implemented:** multi-agent generation, validation, idea review/selection |
| Scripts and approval | **Implemented:** script/scene editing, comments, version snapshots, approval gate |
| Queue and orchestration | **Implemented:** persisted PostgreSQL tasks, retries, leases, cancellation, worker and renderer services |
| Video rendering | **Implemented locally:** FFmpeg composition into playable 9:16 MP4 files with captions |
| Text and image generation | **Implemented adapters:** mock providers; optional OpenAI/Gemini text and OpenAI image providers with configuration |
| Narration | **Not yet complete:** the existing mock voice is a WAV reference tone, not human speech |
| Social publishing | **Mock only:** real platform OAuth, posting, and analytics still require integrations and approvals |
| Image/file upload | **Not yet complete:** local browser upload support is not a finished user feature |
| Hosting | **Not yet deployed in the documented implementation:** Docker and Terraform exist, but production deployment needs setup and verification |
| Billing | **Not yet complete:** plan rules exist; real Stripe checkout/webhook lifecycle is not active |

This baseline is based on source and documentation review, not a fresh successful deployment or full test run. Recheck against merged PRs before marking any planned feature as shipped.

## 6. Primary user journey

1. A user signs in and creates or selects a workspace.
2. The user enters their business name, audience, products/services, and brand tone.
3. The user creates a campaign describing its goal.
4. ContentForge generates strategy and ideas; the user selects one idea.
5. The app generates a script and scene plan, then creates visual assets, narration, and captions.
6. The user watches a playable 9:16 MP4 in Content Studio and sees clear generation status.
7. The user edits the content if needed and requests a new render.
8. The user reviews the final output and approves it for use.
9. The user downloads the video and caption file for manual posting.
10. The user can share product feedback if something was confusing or failed.

For the beta, manual posting is an intentional choice. A successful export must not depend on Instagram, TikTok, YouTube, or Stripe approval.

## 7. Beta feature requirements

Priority definitions: **P0** is necessary for a functional private beta. **P1** improves usability and validation but may follow the core journey. **P2** is a later milestone.

### FR-01: Brand and campaign setup (P0)

**Status:** Existing, with usability improvements planned.

- Users can create or edit a brand with its description, audience, tone, and guidelines.
- Users can create a campaign and select a generated content idea.
- The interface should make the next step obvious without requiring users to understand the backend.

**Acceptance:** A new signed-in user with the correct permissions can progress from brand setup to selecting an idea, with actionable feedback on missing required fields.

### FR-02: Controlled agent workflow (P0)

**Status:** Existing.

- Preserve distinct strategy, ideation, scriptwriting, critic, and bounded revision stages.
- Save step status and outputs so progress can survive a refresh.
- Keep schema validation, request idempotency, retries, and user cancellation.
- AI-generated content must not automatically approve itself for publishing.

**Acceptance:** A chosen idea generates a stored script and scene plan; failures are visible and resumable or retryable only where safe.

### FR-03: Natural spoken narration (P0)

**Status:** Planned.

- Add a real text-to-speech provider using the existing provider abstraction in **packages/ai**.
- Accept the final narration text and a configured voice.
- Store real audio bytes, duration where available, MIME type, provider, model, and estimated/known cost details.
- Keep the mock reference-tone provider for development and automated tests.
- Never quietly replace a failed paid-provider request with mock audio.

**Acceptance:** With valid provider credentials, the generated MP4 contains intelligible speech matching the script. Missing credentials, API failure, and timeouts produce clear failures rather than falsely reporting success.

### FR-04: Rendered video and captions (P0)

**Status:** Existing rendering; real speech integration planned.

- Produce a playable **9:16 MP4** for a short video, initially targeting 15 to 30 seconds.
- Combine scene visuals, on-screen text, spoken audio, and timing-aligned caption tracks.
- Preserve existing FFmpeg-based rendering rather than introducing a second renderer for beta.
- Support preview after page reload and appropriate signed media downloads.

**Acceptance:** A completed video plays in a common browser, has audible narration, readable captions, and downloads as a valid MP4 with a matching SRT or WebVTT caption file.

### FR-05: Studio review and export (P0)

**Status:** Existing studio and review features; UI refinements planned.

- Make the primary actions easy to find: generate, view progress, preview, edit, review, and download.
- Display understandable statuses for queued, generating, rendering, completed, failed, and awaiting approval.
- Preserve editing rules and invalidate previous approval when approved content changes.
- Show a clear video download and caption download action when the relevant files exist.
- Do not advertise mock publication as a real social-media post.

**Acceptance:** A first-time tester can find and export a completed video without being guided through the codebase. A failed generation does not appear ready.

### FR-06: Secure asset uploads (P1)

**Status:** Planned.

- Add authenticated PNG/JPEG uploads scoped to a workspace.
- Check file size, actual file signatures, permissions, and ownership.
- Store files under generated keys and return a safe asset identifier.
- Provide upload progress, success/failure feedback, and a basic preview in the UI.
- Do not claim user uploads influence rendered scenes until that connection is implemented.

**Acceptance:** Authorized uploads work; invalid types, oversized files, unauthenticated requests, and cross-workspace access fail safely.

### FR-07: Onboarding and feedback (P1)

**Status:** Planned refinement.

- Provide a short checklist that guides new users from brand setup to export.
- Explain generation errors in normal language.
- Provide a feedback link or form so testers can report blockers or poor results.

**Acceptance:** Testers can understand the basic steps, and the team can capture feedback linked to the stage where a problem occurred.

### FR-08: Private beta hosting (P0 for external tests)

**Status:** Planned and requires infrastructure verification.

- Host the web app, worker, renderer, PostgreSQL, and shared media storage in a configuration that supports continuously running services.
- Configure HTTPS, production sign-in, secrets, backups, and health checks.
- Keep administrative/database and internal process endpoints private.
- Verify migrations, restarts, scheduled jobs, and media persistence.

**Acceptance:** An invited user can sign in at a private beta URL and complete the video workflow. Restarting a worker does not lose completed media or leave a task permanently stuck.

## 8. Nonfunctional requirements

**Security:** Enforce workspace membership and role permissions on API routes and stored assets. Store API keys only on the server. Validate uploads and user inputs. Keep logs free of passwords, tokens, and arbitrary sensitive provider responses.

**Reliability:** Preserve PostgreSQL-backed durable queues, idempotency, bounded retries, and lease fencing. An external paid call may be billed twice after certain crashes; avoid promises of universal exactly-once billing.

**Quality:** Generated clips must be playable, visually legible on a mobile-sized screen, and understandable with spoken narration and captions. Human review remains mandatory for any publish action.

**Performance:** Measure queue time, provider latency, rendering time, and export success during the pilot. Optimize actual bottlenecks rather than inventing performance claims.

**Cost:** Track known provider usage and estimates per workflow. A configured budget check is not a guaranteed spend ceiling while external requests are still in flight.

**Observability:** Surface safe error messages to users and keep enough workflow information for the team to diagnose failed jobs.

**Testing:** CI should remain free of paid AI calls. Use mocked SDK tests, integration tests with isolated databases, and Playwright coverage for the critical workflow.

## 9. Delivery plan and ownership

This is the feature sequence, not a rigid number-of-commits requirement. Work can be divided into focused pull requests.

| Phase | Darun | Teju | Exit condition |
| --- | --- | --- | --- |
| 1. Foundation | TTS provider, configuration, and tests | Repo hygiene, local Docker setup | Reproducible demo and provider contract |
| 2. Core video | Connect speech to workflow and FFmpeg, test narration | Secure upload validation and API | Narrated MP4 works locally |
| 3. Beta UX | Progress states, preview, exports, uploader UI | Staging runtime, authentication, backups | End-to-end private beta URL works |
| 4. Pilot | Onboarding, tester sessions, feedback | Reliability tests and fixes | Three users test and findings are documented |

Use small PRs against **main**. Review each other's changes and merge only after relevant checks pass. The separate [development plan](https://docs.google.com/document/d/13TYCROms2jgiQEsm3eRoHIDZBdTVvc0fCiEy7cEv1Sg/edit) contains a suggested task-by-task order.

## 10. Release acceptance checklist

A private beta is ready for external testing when all of the following are true:

- [ ] A new invited user can authenticate without development-only credentials.
- [ ] A user can create a brand, campaign, and select an idea.
- [ ] The generation workflow produces a real narrated video with scenes and captions.
- [ ] The 9:16 MP4 plays in the browser and can be downloaded.
- [ ] A matching caption file can be downloaded.
- [ ] Generation progress and failures remain understandable after refresh.
- [ ] Required approvals and permissions remain enforced.
- [ ] Web, worker, and renderer can run reliably on staging using persistent storage.
- [ ] Sensitive credentials, internal ports, and workspace media are not exposed.
- [ ] The team has confirmed basic restart and database-backup recovery.
- [ ] The full critical path has passing automated checks or clearly documented exceptions.
- [ ] Three testers have completed sessions and the team has captured their feedback.

The release checklist is stricter than any single pull request. Do not mark the beta ready just because the UI or staging homepage loads.

## 11. Out of scope for this beta

- Real Instagram, TikTok, YouTube, X, Facebook, or Threads OAuth and automatic posting.
- Real social analytics; mock analytics must remain clearly labeled.
- Stripe checkout, paid subscriptions, and customer billing.
- Automatic video generation from a video model, complex motion graphics, and multiple production aspect ratios.
- GCS/Cloud Tasks migration, advanced enterprise features, SSO/SCIM, and white labeling.
- Full PDF extraction, semantic vector search, and autonomous multi-platform publishing.

These may be reconsidered after users consistently produce and export valuable videos.

## 12. Main risks and decisions

| Risk | Impact | Proposed response |
| --- | --- | --- |
| TTS API failures or unexpected costs | Broken videos, unbounded expense | Mocked CI, explicit real-provider selection, error handling, observed usage |
| Narration duration differs from scene plan | Awkward pacing or truncated audio | Check duration and define a consistent audio/render timing policy |
| Local file storage does not work across services | Missing media or failed previews | Shared persistent storage and an end-to-end container test |
| Staging service shuts down between jobs | Stuck workflow tasks | Use persistent worker/renderer compute and test restart recovery |
| Users get lost in the generation steps | Poor activation | Short onboarding checklist and real usability tests |
| Uploads bypass workspace boundaries | Cross-tenant exposure | Permission checks, ownership validation, negative security tests |
| Too much scope before launch | No usable beta | Focus on real voice, reliable render, export, and first testers |

## 13. Open questions

1. Which initial user segment is most interested: local businesses, creators, or agencies?
2. Will beta users need to upload their own brand images for the first test, or can this remain a follow-up?
3. Which voice, style, and narration pacing will the initial default use?
4. Should users be allowed to download a draft without approval, with a visible draft label, or only approved videos?
5. Where will the beta be hosted, and which email provider will handle production magic links?
6. What is the target paid-provider budget for the pilot?
7. What does a user consider a video worth posting? Evaluate with interviews, not assumptions.

## 14. Reference documents

- [README.md](README.md): current application, setup, and local demo
- [TASKS.md](TASKS.md): implemented features versus gaps
- [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md): broader product requirements and future platform scope
- [ARCHITECTURE.md](ARCHITECTURE.md): services, queue behavior, and deployment constraints
- [DATA_MODEL.md](DATA_MODEL.md): Prisma model responsibilities
- [SECURITY.md](SECURITY.md): security boundaries and limitations
- [DEPLOYMENT.md](DEPLOYMENT.md): current hosting and operational requirements
- [docs/demo-script.md](docs/demo-script.md): locally verified intended walkthrough
