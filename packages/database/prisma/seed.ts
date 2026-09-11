/**
 * Seed script — built up incrementally, phase by phase (see DATA_MODEL.md
 * §5). The fixtures cover the complete local journey without external APIs.
 */
import { DEMO_USER_EMAIL, DEMO_WORKSPACE_SLUG, PLAN_CATALOG } from "@contentforge/shared";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPlanCatalog() {
  for (const plan of PLAN_CATALOG) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        monthlyPriceCents: plan.monthlyPriceCents,
        contentItemsPerMonth: plan.contentItemsPerMonth,
        socialConnectionsLimit: plan.socialConnectionsLimit,
        brandsLimit: plan.brandsLimit,
        teamMembersLimit: plan.teamMembersLimit,
        hasAnalytics: plan.hasAnalytics,
        hasCalendar: plan.hasCalendar,
        hasCustomTemplates: plan.hasCustomTemplates,
        hasClientApprovalLinks: plan.hasClientApprovalLinks,
        priorityRendering: plan.priorityRendering,
      },
      create: {
        key: plan.key,
        name: plan.name,
        monthlyPriceCents: plan.monthlyPriceCents,
        contentItemsPerMonth: plan.contentItemsPerMonth,
        socialConnectionsLimit: plan.socialConnectionsLimit,
        brandsLimit: plan.brandsLimit,
        teamMembersLimit: plan.teamMembersLimit,
        hasAnalytics: plan.hasAnalytics,
        hasCalendar: plan.hasCalendar,
        hasCustomTemplates: plan.hasCustomTemplates,
        hasClientApprovalLinks: plan.hasClientApprovalLinks,
        priorityRendering: plan.priorityRendering,
      },
    });
  }
  console.log(`  Seeded ${PLAN_CATALOG.length} plans`);
}

async function seedDemoWorkspace() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: { isPlatformAdmin: true },
    create: {
      email: DEMO_USER_EMAIL,
      name: "Jordan Rivera",
      emailVerified: new Date(),
      isPlatformAdmin: true,
    },
  });

  const starterPlan = await prisma.plan.findUniqueOrThrow({ where: { key: "starter" } });

  const workspace = await prisma.workspace.upsert({
    where: { slug: DEMO_WORKSPACE_SLUG },
    update: {},
    create: {
      name: "Riverbend Coffee Roasters",
      slug: DEMO_WORKSPACE_SLUG,
      createdByUserId: user.id,
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
      subscription: {
        create: {
          planId: starterPlan.id,
          status: "TRIALING",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      },
      usageLimit: {
        create: {
          contentItemsPerMonth: starterPlan.contentItemsPerMonth,
          socialConnectionsLimit: starterPlan.socialConnectionsLimit,
          brandsLimit: starterPlan.brandsLimit,
          teamMembersLimit: starterPlan.teamMembersLimit,
          monthlyBudgetCents: 2000,
          budgetWarningPct: 0.8,
        },
      },
    },
  });

  console.log(`  Seeded demo user (${user.email}) and workspace (${workspace.slug})`);
  return { user, workspace };
}

async function seedDemoJourney(userId: string, workspaceId: string) {
  let brand = await prisma.brand.findFirst({ where: { workspaceId, slug: "riverbend-coffee" } });
  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        workspaceId,
        name: "Riverbend Coffee Roasters",
        slug: "riverbend-coffee",
        industry: "Specialty coffee roaster and neighborhood cafe",
        website: "https://example.com/riverbend",
        description:
          "A fictional independent roaster making excellent coffee approachable for the local community.",
        productsServices:
          "Fresh roasted coffee, tasting flights, brewing classes, wholesale beans, and cafe service.",
        targetCustomers:
          "Curious coffee drinkers, busy professionals, and local hospitality teams.",
        geographicMarket: "Madison, Wisconsin and nearby communities",
        postsPerWeekTarget: 3,
        primaryColor: "#111827",
        secondaryColor: "#7C3AED",
        accentColor: "#22D3EE",
        status: "ACTIVE",
        brandVoice: {
          create: {
            toneTags: ["warm", "knowledgeable", "unpretentious"],
            personality: "A generous expert who explains craft without gatekeeping.",
            writingStyleNotes: "Short sentences, concrete sensory language, one clear CTA.",
            preferredPhrases: ["Brew with curiosity", "Made here, shared here"],
            wordsToAvoid: ["miracle", "detox", "guaranteed"],
            sampleText: "Better coffee starts with curiosity, not expensive gear.",
          },
        },
        guidelines: {
          create: [
            {
              type: "PROHIBITED_CLAIM",
              content: "Never claim coffee treats, cures, or prevents a health condition.",
            },
            { type: "REQUIRED_DISCLAIMER", content: "Clearly state offer terms and availability." },
            { type: "CTA_STANDARD", content: "Invite one useful, low-pressure next action." },
          ],
        },
      },
    });
  }
  if (!(await prisma.knowledgeSource.findFirst({ where: { brandId: brand.id } }))) {
    const source = await prisma.knowledgeSource.create({
      data: {
        brandId: brand.id,
        workspaceId,
        type: "MANUAL_TEXT",
        status: "READY",
        title: "Riverbend product and service guide",
        extractedText:
          "Morning Flight: three 4oz coffees every Saturday. Home Brew Workshop: 60-minute hands-on class. House espresso tastes like cocoa, cherry, and caramel.",
      },
    });
    await prisma.knowledgeChunk.create({
      data: {
        knowledgeSourceId: source.id,
        brandId: brand.id,
        chunkIndex: 0,
        content: "Morning Flight: three 4oz coffees every Saturday.",
        embedding: [0.1, 0.2, 0.3],
        tokenCount: 11,
      },
    });
  }

  let campaign = await prisma.campaign.findFirst({
    where: { workspaceId, name: "Brew With Curiosity" },
  });
  if (!campaign)
    campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        brandId: brand.id,
        name: "Brew With Curiosity",
        objective:
          "Increase local awareness and tasting-flight bookings with useful coffee education.",
        theme: "Make better coffee feel welcoming",
        startDate: new Date("2026-09-01T00:00:00Z"),
        endDate: new Date("2026-09-30T23:59:59Z"),
        targetPlatforms: ["INSTAGRAM", "FACEBOOK", "YOUTUBE"],
        status: "ACTIVE",
        strategyGeneratedAt: new Date(),
        strategyJson: {
          audiencePains: ["Inconsistent home coffee"],
          audienceDesires: ["A reliable morning ritual"],
          successMetrics: ["saves", "completion rate", "bookings"],
        },
        pillars: {
          create: [
            {
              name: "Coffee education",
              description: "Practical, friendly brewing knowledge",
              audiencePain: "Coffee terminology feels intimidating",
              audienceDesire: "Brew confidently",
              targetMixPercent: 50,
            },
            {
              name: "People and craft",
              description: "Show the people and process behind each roast",
              targetMixPercent: 30,
            },
            {
              name: "Products and offers",
              description: "Useful, transparent product stories",
              targetMixPercent: 20,
            },
          ],
        },
      },
    });
  const pillars = await prisma.contentPillar.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "asc" },
  });
  if ((await prisma.contentIdea.count({ where: { campaignId: campaign.id } })) === 0) {
    const ideaData = [
      [
        "Taste coffee in three steps",
        "Your coffee has three clues hiding in every sip.",
        "INSTAGRAM",
        "SHORT_VIDEO_9X16",
        "LOW",
      ],
      [
        "Myth: dark roast means more caffeine",
        "Darker does not automatically mean stronger.",
        "INSTAGRAM",
        "SHORT_VIDEO_9X16",
        "LOW",
      ],
      [
        "Meet the morning flight",
        "Three small cups. One surprisingly big flavor trip.",
        "FACEBOOK",
        "CAROUSEL",
        "MEDIUM",
      ],
      [
        "From green bean to Riverbend",
        "This color change decides what ends up in your cup.",
        "YOUTUBE",
        "VIDEO_16X9",
        "HIGH",
      ],
      [
        "Your two-minute better brew",
        "Before buying another brewer, change these two things.",
        "THREADS",
        "THREAD",
        "LOW",
      ],
    ] as const;
    await Promise.all(
      ideaData.map((idea, index) =>
        prisma.contentIdea.create({
          data: {
            workspaceId,
            campaignId: campaign!.id,
            pillarId: pillars[index % Math.max(pillars.length, 1)]?.id,
            title: idea[0],
            hook: idea[1],
            targetPlatform: idea[2],
            format: idea[3],
            productionDifficulty: idea[4],
            audienceProblem: "Customers want better coffee without intimidating jargon.",
            mainTakeaway: "Small, repeatable habits make tasting and brewing approachable.",
            callToAction: index === 2 ? "Book a Saturday tasting." : "Save this for your next cup.",
            estimatedDurationSeconds: index === 3 ? 45 : 24,
            requiredAssets: ["coffee cup", "roastery detail"],
            noveltyExplanation:
              "Uses a concise visual teaching structure grounded in the brand voice.",
            complianceNotes: index === 1 ? "Avoid health and performance claims." : null,
            status: index === 0 ? "ACCEPTED" : "PROPOSED",
          },
        }),
      ),
    );
  }
  const idea = await prisma.contentIdea.findFirstOrThrow({
    where: { campaignId: campaign.id, status: "ACCEPTED" },
  });

  let template = await prisma.renderTemplate.findFirst({
    where: { workspaceId: null, key: "EDUCATIONAL_LIST" },
  });
  if (!template)
    template = await prisma.renderTemplate.create({
      data: {
        key: "EDUCATIONAL_LIST",
        name: "Educational list",
        description: "Numbered learning beats with animated text and brand-safe colors.",
        config: { captions: "bold-bottom", safeArea: true, introSeconds: 1, outroSeconds: 2 },
      },
    });
  for (const [key, name] of [
    ["MYTH_VS_FACT", "Myth versus fact"],
    ["PROMOTIONAL_OFFER", "Promotional offer"],
  ] as const)
    if (!(await prisma.renderTemplate.findFirst({ where: { workspaceId: null, key } })))
      await prisma.renderTemplate.create({
        data: {
          key,
          name,
          description: `${name} original ContentForge template.`,
          config: { safeArea: true, watermark: false },
        },
      });

  let content = await prisma.contentItem.findFirst({
    where: { workspaceId, title: "Taste coffee in three steps" },
  });
  if (!content)
    content = await prisma.contentItem.create({
      data: {
        workspaceId,
        brandId: brand.id,
        campaignId: campaign.id,
        pillarId: pillars[0]?.id,
        contentIdeaId: idea.id,
        title: idea.title,
        status: "APPROVED",
        primaryFormat: "SHORT_VIDEO_9X16",
        complianceAcknowledged: true,
        complianceAcknowledgedByUserId: userId,
        complianceAcknowledgedAt: new Date(),
        createdByUserId: userId,
        variants: {
          create: {
            workspaceId,
            platform: "INSTAGRAM",
            aspectRatio: "RATIO_9X16",
            format: "SHORT_VIDEO_9X16",
            captionText:
              "Taste coffee with confidence: aroma, acidity, finish. Which clue do you notice first?",
            hashtags: ["#CoffeeTips", "#LocalCoffee", "#RiverbendRoasters"],
            titleAlternatives: ["Taste coffee in three steps", "A no-jargon tasting guide"],
            thumbnailText: "Taste coffee better",
            isPrimary: true,
            script: {
              create: {
                openingHook: "Your coffee has three clues hiding in every sip.",
                narration:
                  "First, smell before you sip. Next, notice whether it feels bright or round. Finally, pay attention to what lingers. Save this guide for tomorrow morning.",
                onScreenText: "1 · Aroma\n2 · Bright or round?\n3 · The finish",
                cta: "Save this guide for tomorrow morning.",
                caption: "Taste coffee with confidence: aroma, acidity, finish.",
                titleAlternatives: ["Taste coffee in three steps", "A no-jargon tasting guide"],
                hashtags: ["#CoffeeTips", "#LocalCoffee"],
                thumbnailText: "Taste coffee better",
                promptVersion: "script-v1.0.0",
                modelId: "contentforge-mock-v1",
                modelMetadata: { deterministic: true },
                scenes: {
                  create: [
                    {
                      sequenceNumber: 1,
                      startTimeMs: 0,
                      endTimeMs: 6000,
                      narration: "Your coffee has three clues hiding in every sip.",
                      onScreenText: "Taste coffee better",
                      visualPrompt: "Steam rising from a ceramic cup",
                      assetType: "COLOR_BACKGROUND",
                      transition: "FADE",
                      motionInstruction: "Slow push in",
                      audioInstruction: "Music at -22 LUFS",
                      safeAreaNotes: "Center title inside vertical safe area",
                    },
                    {
                      sequenceNumber: 2,
                      startTimeMs: 6000,
                      endTimeMs: 13000,
                      narration: "First, smell before you sip.",
                      onScreenText: "1 · Aroma",
                      visualPrompt: "Close-up of coffee aroma",
                      assetType: "COLOR_BACKGROUND",
                      transition: "SLIDE",
                      motionInstruction: "Pan left",
                      audioInstruction: "Subtle whoosh",
                      safeAreaNotes: "Lower third above controls",
                    },
                    {
                      sequenceNumber: 3,
                      startTimeMs: 13000,
                      endTimeMs: 19000,
                      narration: "Next, notice whether it feels bright or round.",
                      onScreenText: "2 · Bright or round?",
                      visualPrompt: "Two coffee cups",
                      assetType: "COLOR_BACKGROUND",
                      transition: "CUT",
                      motionInstruction: "Gentle parallax",
                      audioInstruction: "Duck music under voice",
                      safeAreaNotes: "Centered",
                    },
                    {
                      sequenceNumber: 4,
                      startTimeMs: 19000,
                      endTimeMs: 24000,
                      narration: "Finally, notice what lingers. Save this guide.",
                      onScreenText: "3 · The finish",
                      visualPrompt: "Coffee bag and cup",
                      assetType: "COLOR_BACKGROUND",
                      transition: "FADE",
                      motionInstruction: "Logo reveal",
                      audioInstruction: "Music resolve",
                      safeAreaNotes: "Centered",
                    },
                  ],
                },
                captionTracks: {
                  create: [
                    { format: "SRT", storageKey: "demo/captions/taste-coffee.srt", language: "en" },
                    {
                      format: "WEBVTT",
                      storageKey: "demo/captions/taste-coffee.vtt",
                      language: "en",
                    },
                  ],
                },
                voiceTracks: {
                  create: {
                    storageKey: "demo/audio/placeholder-voice.wav",
                    durationSeconds: 24,
                    providerName: "mock",
                    voiceId: "local-placeholder",
                    costCents: 0,
                  },
                },
              },
            },
          },
        },
      },
    });
  const variant = await prisma.contentVariant.findFirstOrThrow({
    where: { contentItemId: content.id, isPrimary: true },
  });
  let renderJob = await prisma.renderJob.findFirst({
    where: { workspaceId, idempotencyKey: "demo-render-v1" },
  });
  if (!renderJob)
    renderJob = await prisma.renderJob.create({
      data: {
        workspaceId,
        contentVariantId: variant.id,
        renderTemplateId: template.id,
        status: "SUCCEEDED",
        idempotencyKey: "demo-render-v1",
        aspectRatios: ["RATIO_9X16", "RATIO_1X1", "RATIO_16X9"],
        progressPercent: 100,
        startedAt: new Date(Date.now() - 12_000),
        completedAt: new Date(),
        durationMs: 12_000,
        costCents: 0,
        outputs: {
          create: [
            {
              aspectRatio: "RATIO_9X16",
              storageKey: "demo/renders/taste-coffee-9x16.mp4",
              thumbnailStorageKey: "demo/renders/taste-coffee-thumb.jpg",
              durationSeconds: 24,
              width: 1080,
              height: 1920,
              fileSizeBytes: 1_250_000,
            },
            {
              aspectRatio: "RATIO_1X1",
              storageKey: "demo/renders/taste-coffee-1x1.mp4",
              durationSeconds: 24,
              width: 1080,
              height: 1080,
              fileSizeBytes: 980_000,
            },
            {
              aspectRatio: "RATIO_16X9",
              storageKey: "demo/renders/taste-coffee-16x9.mp4",
              durationSeconds: 24,
              width: 1920,
              height: 1080,
              fileSizeBytes: 1_340_000,
            },
          ],
        },
      },
    });
  if (!(await prisma.approvalRequest.findFirst({ where: { contentItemId: content.id } })))
    await prisma.approvalRequest.create({
      data: {
        workspaceId,
        contentItemId: content.id,
        status: "APPROVED",
        requestedByUserId: userId,
        decisions: {
          create: {
            decidedByUserId: userId,
            decision: "APPROVED",
            notes: "Brand voice, safe areas, and offer language verified.",
          },
        },
      },
    });
  let connection = await prisma.socialConnection.findFirst({
    where: { workspaceId, platform: "MOCK" },
  });
  if (!connection)
    connection = await prisma.socialConnection.create({
      data: {
        workspaceId,
        platform: "MOCK",
        status: "ACTIVE",
        scopes: ["publish", "analytics"],
        externalUserId: "riverbend-demo",
        connectedByUserId: userId,
        lastValidatedAt: new Date(),
        accounts: {
          create: {
            workspaceId,
            platform: "MOCK",
            externalAccountId: "riverbend-social",
            displayName: "Riverbend Coffee",
            handle: "@riverbendcoffee",
            capabilities: {
              video: true,
              images: true,
              analytics: true,
              scheduling: true,
              mock: true,
            },
          },
        },
      },
    });
  const account = await prisma.socialAccount.findFirstOrThrow({
    where: { socialConnectionId: connection.id },
  });
  if (
    !(await prisma.publishJob.findFirst({
      where: { workspaceId, idempotencyKey: "demo-published-v1" },
    }))
  )
    await prisma.publishJob.create({
      data: {
        workspaceId,
        contentVariantId: variant.id,
        socialAccountId: account.id,
        status: "PUBLISHED",
        scheduledAt: new Date(Date.now() - 86_400_000),
        idempotencyKey: "demo-published-v1",
        attemptCount: 1,
        publishedPost: {
          create: {
            workspaceId,
            socialAccountId: account.id,
            platform: "MOCK",
            externalPostId: "mock-riverbend-001",
            permalink: "/mock-social/posts/mock-riverbend-001",
            publishedAt: new Date(Date.now() - 86_000_000),
            rawResponseJson: { provider: "mock", redacted: true },
            analyticsSnapshots: {
              create: {
                workspaceId,
                capturedAt: new Date(),
                views: 1840,
                reach: 1290,
                impressions: 2134,
                likes: 164,
                comments: 18,
                shares: 34,
                saves: 87,
                watchTimeSeconds: 27_600,
                avgViewDurationSeconds: 15,
                completionRate: 0.625,
                clicks: 42,
                followersGained: 11,
              },
            },
          },
        },
      },
    });
  if (
    !(await prisma.contentItem.findFirst({
      where: { workspaceId, title: "Morning flight reminder" },
    }))
  )
    await prisma.contentItem.create({
      data: {
        workspaceId,
        brandId: brand.id,
        campaignId: campaign.id,
        pillarId: pillars[2]?.id,
        title: "Morning flight reminder",
        status: "SCHEDULED",
        primaryFormat: "FEED_4X5",
        scheduledAt: new Date(Date.now() + 2 * 86_400_000),
        complianceAcknowledged: true,
        complianceAcknowledgedByUserId: userId,
        complianceAcknowledgedAt: new Date(),
        createdByUserId: userId,
      },
    });
  if (!(await prisma.workflowRun.findFirst({ where: { workspaceId, type: "CONTENT_PRODUCTION" } })))
    await prisma.workflowRun.create({
      data: {
        workspaceId,
        contentItemId: content.id,
        type: "CONTENT_PRODUCTION",
        status: "SUCCEEDED",
        currentStepIndex: 5,
        totalCostCents: 0,
        steps: {
          create: ["strategy", "ideas", "script", "scenes", "render"].map((name, index) => ({
            sequenceNumber: index,
            name,
            status: "SUCCEEDED" as const,
            idempotencyKey: `demo-${name}-v1`,
            input: { promptVersion: "v1.0.0" },
            output: { provider: "mock" },
            costCents: 0,
            startedAt: new Date(Date.now() - (20 - index) * 1000),
            completedAt: new Date(Date.now() - (19 - index) * 1000),
          })),
        },
      },
    });
  if ((await prisma.usageEvent.count({ where: { workspaceId } })) === 0)
    await prisma.usageEvent.createMany({
      data: [
        {
          workspaceId,
          type: "CONTENT_ITEM_GENERATED",
          quantity: 1,
          costCents: 0,
          referenceType: "ContentItem",
          referenceId: content.id,
          periodMonth: "2026-09",
        },
        {
          workspaceId,
          type: "RENDER_MINUTE",
          quantity: 1,
          costCents: 0,
          referenceType: "RenderJob",
          referenceId: renderJob.id,
          periodMonth: "2026-09",
        },
        {
          workspaceId,
          type: "PUBLISH",
          quantity: 1,
          costCents: 0,
          referenceType: "PublishedPost",
          periodMonth: "2026-09",
        },
      ],
    });
  if (!(await prisma.auditLog.findFirst({ where: { workspaceId, action: "demo.journey.seeded" } })))
    await prisma.auditLog.createMany({
      data: [
        {
          workspaceId,
          actorUserId: userId,
          action: "brand.profile.completed",
          targetType: "Brand",
          targetId: brand.id,
          metadata: { source: "seed" },
        },
        {
          workspaceId,
          actorUserId: userId,
          action: "content.approved",
          targetType: "ContentItem",
          targetId: content.id,
        },
        {
          workspaceId,
          actorType: "SYSTEM",
          action: "social.post.published",
          targetType: "ContentItem",
          targetId: content.id,
        },
        {
          workspaceId,
          actorType: "SYSTEM",
          action: "demo.journey.seeded",
          targetType: "Workspace",
          targetId: workspaceId,
        },
      ],
    });
  console.log(
    "  Seeded complete demo brand, campaign, production, approval, publishing, analytics, usage, and audit journey",
  );
}

async function main() {
  console.log("Seeding database...");
  await seedPlanCatalog();
  const { user, workspace } = await seedDemoWorkspace();
  await seedDemoJourney(user.id, workspace.id);
  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
