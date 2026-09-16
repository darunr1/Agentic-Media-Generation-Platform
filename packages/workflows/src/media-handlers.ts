import { createHash } from "node:crypto";

import {
  MockImageGenerationProvider,
  OpenAIImageGenerationProvider,
  MockTextToSpeechProvider,
} from "@contentforge/ai";
import { prisma } from "@contentforge/database";
import {
  LocalObjectStorageProvider,
  localStorageRoot,
  toSrt,
  toWebVtt,
  renderScenes,
} from "@contentforge/media";
import { z } from "zod";

import { PermanentTaskError, type TaskRegistry } from "./executor";
import type { QueueTask } from "./queue";
import { advance, fencedTransaction, loadTask, runStep } from "./runtime";

async function loadProduction(task: QueueTask, signal: AbortSignal) {
  const payload = await loadTask(task, signal);
  if ((process.env.STORAGE_PROVIDER ?? "local") !== "local")
    throw new PermanentTaskError("Storage provider setup required; configure local");
  if (!payload.contentItemId) throw new PermanentTaskError("Content item required");
  const variant = await prisma.contentVariant.findFirst({
    where: {
      workspaceId: task.workspaceId,
      contentItemId: payload.contentItemId,
      isPrimary: true,
      deletedAt: null,
      contentItem: { deletedAt: null, brand: { deletedAt: null } },
    },
    include: {
      script: {
        include: {
          scenes: { orderBy: { sequenceNumber: "asc" }, include: { mediaAsset: true } },
          voiceTracks: true,
          captionTracks: true,
        },
      },
      contentItem: true,
    },
  });
  if (!variant?.script) throw new PermanentTaskError("Script unavailable");
  return {
    payload,
    variant,
    script: variant.script,
    storage: new LocalObjectStorageProvider(localStorageRoot()),
  };
}
export const mediaHandlers: TaskRegistry = {
  "generation.assets": {
    async execute(task, signal) {
      const { payload, script, variant, storage } = await loadProduction(task, signal);
      const selected = process.env.AI_IMAGE_PROVIDER ?? "mock";
      if (!["mock", "openai"].includes(selected))
        throw new PermanentTaskError("Image provider setup required");
      const provider =
        selected === "openai"
          ? new OpenAIImageGenerationProvider()
          : new MockImageGenerationProvider();
      provider.validateConfiguration();
      for (const [index, scene] of script.scenes.entries()) {
        const sequence = 20 + index;
        await runStep(
          task,
          signal,
          sequence,
          `MediaGeneration.${scene.sequenceNumber}`,
          z.object({ assetId: z.string(), storageKey: z.string() }),
          async () => {
            const existing = await prisma.mediaAsset.findFirst({
              where: {
                workspaceId: task.workspaceId,
                generationJobId: `${task.workflowRunId}-${sequence}`,
              },
            });
            if (existing)
              return {
                data: { assetId: existing.id, storageKey: existing.storageKey },
                usage: {
                  provider: existing.providerName ?? "mock",
                  model: existing.model ?? "unknown",
                  costCents: existing.providerCostCents ?? 0,
                  durationMs: 0,
                },
              };
            const result = await provider.generateImage({
              prompt: scene.visualPrompt,
              idempotencyKey: `${task.idempotencyKey}:${scene.id}`,
              width: 360,
              height: 640,
              signal,
            });
            const digest = createHash("sha256").update(result.data.bytes).digest("hex");
            const key = `${task.workspaceId}/${task.workflowRunId}/scene-${scene.sequenceNumber}-${digest}.png`;
            const object = await storage.put(key, result.data.bytes, result.data.mimeType);
            const asset = await fencedTransaction(task, signal, async (tx) => {
              const created = await tx.mediaAsset.create({
                data: {
                  workspaceId: task.workspaceId,
                  brandId: variant.contentItem.brandId,
                  sourceType: "AI_GENERATED",
                  kind: "IMAGE",
                  storageKey: key,
                  mimeType: result.data.mimeType,
                  sizeBytes: object.sizeBytes,
                  checksumSha256: object.checksumSha256,
                  width: result.data.width,
                  height: result.data.height,
                  providerName: result.usage.provider,
                  model: result.usage.model,
                  prompt: scene.visualPrompt,
                  generatedAt: new Date(),
                  workflowRunId: task.workflowRunId,
                  generationJobId: `${task.workflowRunId}-${sequence}`,
                  providerCostCents: result.usage.costCents,
                },
              });
              await tx.scene.update({
                where: { id: scene.id },
                data: { mediaAssetId: created.id },
              });
              return created;
            });
            return { data: { assetId: asset.id, storageKey: key }, usage: result.usage };
          },
          "IMAGE",
        );
      }
      await advance(task, signal, { type: "generation.voice", payload }, "VOICE_GENERATION");
    },
  },
  "generation.voice": {
    async execute(task, signal) {
      const { payload, script, variant, storage } = await loadProduction(task, signal);
      if ((process.env.AI_TTS_PROVIDER ?? "mock") !== "mock")
        throw new PermanentTaskError(
          "Voice provider setup required; configure mock for the reference tone",
        );
      await runStep(
        task,
        signal,
        50,
        "VoiceGeneration",
        z.object({ storageKey: z.string(), durationSeconds: z.number() }),
        async () => {
          const durationSeconds = (script.scenes.at(-1)?.endTimeMs ?? 24000) / 1000;
          const key = `${task.workspaceId}/${task.workflowRunId}/voice.wav`;
          const result = await new MockTextToSpeechProvider().synthesize({
            text: script.narration,
            voice: "reference-tone",
            idempotencyKey: task.idempotencyKey,
            durationSeconds,
          });
          const object = await storage.put(key, result.data.bytes, result.data.mimeType);
          await fencedTransaction(task, signal, async (tx) => {
            if (await tx.voiceTrack.findFirst({ where: { scriptId: script.id, storageKey: key } }))
              return;
            await tx.voiceTrack.create({
              data: {
                scriptId: script.id,
                storageKey: key,
                durationSeconds,
                providerName: "mock",
                voiceId: "reference-tone",
                costCents: 0,
                generationJobId: `${task.workflowRunId}-50`,
              },
            });
            await tx.mediaAsset.create({
              data: {
                workspaceId: task.workspaceId,
                brandId: variant.contentItem.brandId,
                sourceType: "AI_GENERATED",
                kind: "AUDIO",
                storageKey: key,
                mimeType: "audio/wav",
                sizeBytes: object.sizeBytes,
                checksumSha256: object.checksumSha256,
                durationSeconds,
                providerName: "mock",
                model: result.usage.model,
                prompt: script.narration,
                generatedAt: new Date(),
                workflowRunId: task.workflowRunId,
                generationJobId: `${task.workflowRunId}-50`,
                providerCostCents: 0,
              },
            });
          });
          return { data: { storageKey: key, durationSeconds }, usage: result.usage };
        },
        "VOICE",
      );
      await advance(task, signal, { type: "generation.captions", payload }, "CAPTION_GENERATION");
    },
  },
  "generation.captions": {
    async execute(task, signal) {
      const { payload, script, storage } = await loadProduction(task, signal);
      await runStep(
        task,
        signal,
        60,
        "CaptionGeneration",
        z.object({ tracks: z.array(z.string()) }),
        async () => {
          const cues = script.scenes.map((s) => ({
            startSeconds: s.startTimeMs / 1000,
            endSeconds: s.endTimeMs / 1000,
            text: s.narration,
          }));
          const tracks: string[] = [];
          for (const [format, bytes, extension] of [
            ["SRT", toSrt(cues), "srt"],
            ["WEBVTT", toWebVtt(cues), "vtt"],
          ] as const) {
            const key = `${task.workspaceId}/${task.workflowRunId}/captions.${extension}`;
            await storage.put(
              key,
              Buffer.from(bytes),
              format === "WEBVTT" ? "text/vtt" : "application/x-subrip",
            );
            await fencedTransaction(task, signal, (tx) =>
              tx.captionTrack.upsert({
                where: {
                  scriptId_format_language: { scriptId: script.id, format, language: "en" },
                },
                create: {
                  scriptId: script.id,
                  format,
                  language: "en",
                  storageKey: key,
                  generationJobId: `${task.workflowRunId}-60`,
                },
                update: { storageKey: key },
              }),
            );
            tracks.push(key);
          }
          return {
            data: { tracks },
            usage: { provider: "local", model: "scene-timings-v1", costCents: 0, durationMs: 0 },
          };
        },
        "TRANSCRIPTION",
      );
      await advance(task, signal, { type: "render.video", payload }, "RENDERING");
    },
  },
};
export const renderHandlers: TaskRegistry = {
  "render.video": {
    async execute(task, signal) {
      const { payload, script, variant, storage } = await loadProduction(task, signal);
      const template = await prisma.renderTemplate.findFirst({
        where: {
          key: "EDUCATIONAL_LIST",
          OR: [{ workspaceId: null }, { workspaceId: task.workspaceId }],
        },
      });
      if (!template) throw new PermanentTaskError("Render template unavailable; run database seed");
      const job = await fencedTransaction(task, signal, (tx) =>
        tx.renderJob.upsert({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: task.workspaceId,
              idempotencyKey: task.idempotencyKey,
            },
          },
          create: {
            workspaceId: task.workspaceId,
            contentVariantId: variant.id,
            renderTemplateId: template.id,
            idempotencyKey: task.idempotencyKey,
            aspectRatios: [variant.aspectRatio],
            status: "RUNNING",
            startedAt: new Date(),
          },
          update: { status: "RUNNING" },
        }),
      );
      await runStep(
        task,
        signal,
        70,
        "Rendering",
        z.object({ storageKey: z.string(), sizeBytes: z.number(), durationSeconds: z.number() }),
        async () => {
          const previous = await prisma.renderedAsset.findFirst({ where: { renderJobId: job.id } });
          if (previous)
            return {
              data: {
                storageKey: previous.storageKey,
                sizeBytes: previous.fileSizeBytes,
                durationSeconds:
                  previous.durationSeconds ?? (script.scenes.at(-1)?.endTimeMs ?? 0) / 1000,
              },
              usage: {
                provider: "ffmpeg",
                model: "scene-compositor-v1",
                durationMs: 0,
                costCents: 0,
              },
            };
          if (
            !script.voiceTracks[0] ||
            !script.captionTracks.length ||
            script.scenes.some((s) => !s.mediaAsset)
          )
            throw new PermanentTaskError("Rendering requires scene assets, audio and captions");
          await fencedTransaction(task, signal, (tx) =>
            tx.renderJob.update({ where: { id: job.id }, data: { progressPercent: 10 } }),
          );
          const started = Date.now();
          const rendered = await renderScenes(
            {
              scenes: await Promise.all(
                script.scenes.map(async (s) => ({
                  bytes: await storage.get(s.mediaAsset!.storageKey),
                  durationSeconds: (s.endTimeMs - s.startTimeMs) / 1000,
                  text: s.onScreenText ?? "",
                  caption: s.narration,
                })),
              ),
              audio: await storage.get(script.voiceTracks[0].storageKey),
              width: 360,
              height: 640,
              timeoutMs: Number(process.env.RENDER_TIMEOUT_MS ?? 120_000),
            },
            signal,
          );
          const digest = createHash("sha256").update(rendered.bytes).digest("hex");
          const key = `${task.workspaceId}/${task.workflowRunId}/video-${digest}.mp4`;
          const object = await storage.put(key, rendered.bytes, "video/mp4");
          await fencedTransaction(task, signal, async (tx) => {
            if (!(await tx.renderedAsset.findFirst({ where: { renderJobId: job.id } })))
              await tx.renderedAsset.create({
                data: {
                  renderJobId: job.id,
                  aspectRatio: variant.aspectRatio,
                  storageKey: key,
                  width: 360,
                  height: 640,
                  durationSeconds: rendered.durationSeconds,
                  fileSizeBytes: rendered.sizeBytes,
                  thumbnailStorageKey: script.scenes[0]?.mediaAsset?.storageKey,
                },
              });
            if (
              !(await tx.mediaAsset.findFirst({
                where: { workspaceId: task.workspaceId, storageKey: key },
              }))
            )
              await tx.mediaAsset.create({
                data: {
                  workspaceId: task.workspaceId,
                  sourceType: "RENDER_OUTPUT",
                  kind: "VIDEO",
                  storageKey: key,
                  mimeType: "video/mp4",
                  sizeBytes: object.sizeBytes,
                  checksumSha256: object.checksumSha256,
                  width: 360,
                  height: 640,
                  durationSeconds: rendered.durationSeconds,
                  providerName: "ffmpeg",
                  model: "scene-compositor-v1",
                  prompt: "Persisted scene plan",
                  generatedAt: new Date(),
                  workflowRunId: task.workflowRunId,
                  generationJobId: `${task.workflowRunId}-70`,
                  providerCostCents: 0,
                },
              });
          });
          return {
            data: {
              storageKey: key,
              sizeBytes: rendered.sizeBytes,
              durationSeconds: rendered.durationSeconds,
            },
            usage: {
              provider: "ffmpeg",
              model: "scene-compositor-v1",
              durationMs: Date.now() - started,
              costCents: 0,
            },
          };
        },
        "VIDEO",
      );
      await fencedTransaction(task, signal, async (tx) => {
        await tx.renderJob.update({
          where: { id: job.id },
          data: { status: "SUCCEEDED", progressPercent: 100, completedAt: new Date() },
        });
        if (
          !(await tx.approvalRequest.findFirst({
            where: { contentItemId: payload.contentItemId, status: "PENDING" },
          }))
        )
          await tx.approvalRequest.create({
            data: {
              workspaceId: task.workspaceId,
              contentItemId: payload.contentItemId!,
              requestedByUserId: payload.userId,
            },
          });
      });
      await advance(task, signal, undefined, "AWAITING_REVIEW");
    },
  },
};
