import {
  StrategyAgent,
  IdeationAgent,
  createTextProvider,
  runScriptAgents,
  strategySchema,
  scriptSchema,
  type ContentIdeaOutput,
  type ProviderResult,
} from "@contentforge/ai";
import { prisma } from "@contentforge/database";
import type { z } from "zod";

import { buildBrandContext } from "./brand-context";
import { PermanentTaskError, type TaskRegistry } from "./executor";
import { advance, fencedTransaction, json, loadTask, runStep } from "./runtime";

const formats = {
  SHORT_VIDEO: "SHORT_VIDEO_9X16",
  FEED_SQUARE: "FEED_1X1",
  FEED_PORTRAIT: "FEED_4X5",
  LANDSCAPE_VIDEO: "VIDEO_16X9",
  TEXT: "TEXT_POST",
  THREAD: "THREAD",
  CAROUSEL: "CAROUSEL",
} as const;
const difficulties = { EASY: "LOW", MEDIUM: "MEDIUM", HARD: "HIGH" } as const;
export const generationHandlers: TaskRegistry = {
  "generation.strategy": {
    async execute(task, signal) {
      const payload = await loadTask(task, signal);
      const campaign = await prisma.campaign.findFirst({
        where: { id: payload.campaignId, workspaceId: task.workspaceId, deletedAt: null },
      });
      if (!campaign || !payload.campaignId) throw new PermanentTaskError("Campaign unavailable");
      const brand = await buildBrandContext(task.workspaceId, campaign.brandId),
        agent = new StrategyAgent();
      const result = await runStep(
        task,
        signal,
        1,
        agent.name,
        agent.schema,
        () =>
          agent.run(
            { brand, objective: campaign.objective, platforms: campaign.targetPlatforms },
            { provider: createTextProvider(), idempotencyKey: task.idempotencyKey, signal },
          ),
        "STRATEGY",
      );
      await fencedTransaction(task, signal, async (tx) => {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            strategyJson: json(result.data),
            strategyGeneratedAt: new Date(),
            theme: result.data.campaignTheme,
            status: "ACTIVE",
          },
        });
        for (const pillar of result.data.contentPillars) {
          const existing = await tx.contentPillar.findFirst({
            where: { campaignId: campaign.id, name: pillar.name },
          });
          const data = {
            description: pillar.description,
            targetMixPercent: Math.round(pillar.percentage),
          };
          if (existing) await tx.contentPillar.update({ where: { id: existing.id }, data });
          else
            await tx.contentPillar.create({
              data: { campaignId: campaign.id, name: pillar.name, ...data },
            });
        }
      });
      await advance(task, signal);
    },
  },
  "generation.ideas": {
    async execute(task, signal) {
      const payload = await loadTask(task, signal);
      const campaign = await prisma.campaign.findFirst({
        where: { id: payload.campaignId, workspaceId: task.workspaceId, deletedAt: null },
        include: { pillars: true },
      });
      if (!campaign || !payload.campaignId) throw new PermanentTaskError("Campaign unavailable");
      const strategy = strategySchema.safeParse(campaign.strategyJson);
      if (!strategy.success) throw new PermanentTaskError("Generate a valid strategy first");
      const brand = await buildBrandContext(task.workspaceId, campaign.brandId),
        agent = new IdeationAgent();
      const result = await runStep(
        task,
        signal,
        2,
        agent.name,
        agent.schema,
        () =>
          agent.run(
            {
              brand,
              strategy: strategy.data,
              objective: campaign.objective,
              platforms: campaign.targetPlatforms,
            },
            { provider: createTextProvider(), idempotencyKey: task.idempotencyKey, signal },
          ),
        "IDEA",
      );
      await fencedTransaction(task, signal, async (tx) => {
        const job = await tx.generationJob.findUniqueOrThrow({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: task.workspaceId,
              idempotencyKey: `${task.workflowRunId}:2`,
            },
          },
        });
        if (await tx.contentIdea.count({ where: { generationJobId: job.id } })) return;
        for (const idea of result.data)
          await tx.contentIdea.create({
            data: {
              workspaceId: task.workspaceId,
              campaignId: campaign.id,
              pillarId:
                campaign.pillars.find((p) => p.name === idea.contentPillar)?.id ??
                campaign.pillars[0]?.id,
              title: idea.title,
              targetPlatform:
                campaign.targetPlatforms.find((p) => p === idea.targetPlatform) ??
                campaign.targetPlatforms[0] ??
                "MOCK",
              format: formats[idea.format],
              hook: idea.hook,
              audienceProblem: idea.audienceProblem,
              mainTakeaway: idea.mainTakeaway,
              callToAction: idea.callToAction,
              productionDifficulty: difficulties[idea.productionDifficulty],
              estimatedDurationSeconds: idea.estimatedDurationSeconds,
              requiredAssets: idea.requiredAssets,
              noveltyExplanation: idea.noveltyExplanation,
              complianceNotes: idea.complianceNotes.join("\n"),
              generationJobId: job.id,
            },
          });
      });
      await advance(task, signal);
    },
  },
  "generation.script": {
    async execute(task, signal) {
      const payload = await loadTask(task, signal);
      const content = await prisma.contentItem.findFirst({
        where: { id: payload.contentItemId, workspaceId: task.workspaceId, deletedAt: null },
        include: {
          contentIdea: { include: { pillar: true } },
          variants: { where: { isPrimary: true, deletedAt: null }, include: { script: true } },
        },
      });
      if (!content?.contentIdea || !payload.contentItemId)
        throw new PermanentTaskError("Accepted content idea unavailable");
      const source = content.contentIdea;
      const idea: ContentIdeaOutput = {
        title: source.title,
        contentPillar: source.pillar?.name ?? "General",
        targetPlatform: source.targetPlatform,
        format: "SHORT_VIDEO",
        hook: source.hook,
        audienceProblem: source.audienceProblem,
        mainTakeaway: source.mainTakeaway,
        callToAction: source.callToAction,
        productionDifficulty: "EASY",
        estimatedDurationSeconds: source.estimatedDurationSeconds ?? 24,
        requiredAssets: source.requiredAssets,
        noveltyExplanation: source.noveltyExplanation,
        complianceNotes: source.complianceNotes ? [source.complianceNotes] : [],
      };
      const brand = await buildBrandContext(task.workspaceId, content.brandId);
      let sequence = 3;
      const result = await runScriptAgents(
        { brand, idea },
        { provider: createTextProvider(), idempotencyKey: task.idempotencyKey, signal },
        <T>(name: string, schema: z.ZodType<T>, execute: () => Promise<ProviderResult<T>>) => {
          const saved = content.variants[0]?.script?.modelMetadata;
          return runStep(
            task,
            signal,
            sequence++,
            name,
            schema,
            name === "ScriptwriterAgent" && payload.preserveScript && saved
              ? async () => ({
                  data: schema.parse(saved),
                  usage: { provider: "human", model: "studio-editor", durationMs: 0, costCents: 0 },
                })
              : execute,
          );
        },
      );
      const script = scriptSchema.parse(result.script.data);
      await fencedTransaction(task, signal, async (tx) => {
        let variant = content.variants[0];
        if (!variant) {
          const created = await tx.contentVariant.create({
            data: {
              workspaceId: task.workspaceId,
              contentItemId: content.id,
              platform: source.targetPlatform,
              aspectRatio: "RATIO_9X16",
              format: "SHORT_VIDEO_9X16",
              isPrimary: true,
              hashtags: [],
              titleAlternatives: [],
            },
            include: { script: true },
          });
          variant = created;
        }
        await tx.contentVariant.update({
          where: { id: variant.id },
          data: {
            captionText:
              script.platformVariants.find((p) => p.platform.toUpperCase() === variant.platform)
                ?.caption ?? script.caption,
            hashtags:
              script.platformVariants.find((p) => p.platform.toUpperCase() === variant.platform)
                ?.hashtags ?? script.hashtags,
            titleAlternatives: script.titleAlternatives,
            thumbnailText: script.thumbnailText,
          },
        });
        const data = {
          openingHook: script.openingHook,
          narration: script.spokenNarration,
          cta: script.callToAction,
          caption: script.caption,
          hashtags: script.hashtags,
          titleAlternatives: script.titleAlternatives,
          onScreenText: script.onScreenText.join("\n"),
          thumbnailText: script.thumbnailText,
          modelId: result.script.usage.model,
          modelMetadata: json(script),
          promptVersion: "agents-v1",
        };
        const saved = await tx.script.upsert({
          where: { contentVariantId: variant.id },
          create: { contentVariantId: variant.id, ...data },
          update: data,
        });
        await tx.scene.deleteMany({ where: { scriptId: saved.id } });
        await tx.voiceTrack.deleteMany({ where: { scriptId: saved.id } });
        await tx.captionTrack.deleteMany({ where: { scriptId: saved.id } });
        for (const scene of script.scenes)
          await tx.scene.create({
            data: {
              scriptId: saved.id,
              sequenceNumber: scene.sequenceNumber,
              startTimeMs: Math.round(scene.startSeconds * 1000),
              endTimeMs: Math.round(scene.endSeconds * 1000),
              narration: scene.narration,
              onScreenText: scene.onScreenText,
              visualPrompt: scene.visualPrompt,
              assetType: "AI_IMAGE",
              transition: "FADE",
              motionInstruction: scene.motionInstruction,
              audioInstruction: scene.audioInstruction,
              safeAreaNotes: scene.safeAreaPosition,
            },
          });
        await tx.contentVersion.create({
          data: {
            workspaceId: task.workspaceId,
            contentItemId: content.id,
            snapshot: json(script),
            createdByUserId: payload.userId,
          },
        });
      });
      if (!result.critique.data.approved)
        throw new PermanentTaskError(
          "Brand review rejected the script after two revisions; edit the script or brand guidance before retrying",
        );
      await advance(task, signal, { type: "generation.assets", payload }, "ASSET_GENERATION");
    },
  },
};
