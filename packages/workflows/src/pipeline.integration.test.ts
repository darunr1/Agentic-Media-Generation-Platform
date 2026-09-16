import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma, PrismaClient } from "@contentforge/database";
import { LocalObjectStorageProvider } from "@contentforge/media";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startGeneration, cancelWorkflow } from "./enqueue";
import { executeNextTask, PermanentTaskError } from "./executor";
import { generationHandlers } from "./generation-handlers";
import { mediaHandlers, renderHandlers } from "./media-handlers";
import { PostgresTaskQueueProvider } from "./postgres-queue";
import { publishingHandlers, decideApproval, scheduleOrPublish } from "./publishing";
import type { QueueTask } from "./queue";
import { recordTaskFailure } from "./runtime";

describe("PostgreSQL worker and media pipeline", () => {
  const suffix = randomUUID(),
    workspaceId = `workspace-${suffix}`,
    userId = `user-${suffix}`;
  const campaignId = `campaign-${suffix}`,
    brandId = `brand-${suffix}`;
  const registry = {
    ...generationHandlers,
    ...mediaHandlers,
    ...renderHandlers,
    ...publishingHandlers,
  };
  const queue = new PostgresTaskQueueProvider();
  let storageRoot = "";
  const job = (type = "test"): QueueTask => ({
    id: randomUUID(),
    workspaceId,
    type,
    payload: {},
    scheduledAt: new Date(0),
    idempotencyKey: randomUUID(),
    attempt: 0,
    maxAttempts: 2,
  });
  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), "contentforge-integration-media-"));
    process.env.LOCAL_STORAGE_DIR = storageRoot;
    await prisma.user.create({ data: { id: userId, email: `${suffix}@example.test` } });
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: "Pipeline test",
        slug: suffix,
        createdByUserId: userId,
        memberships: { create: { userId, role: "OWNER" } },
      },
    });
    const plan = await prisma.plan.create({
      data: {
        key: suffix,
        name: "Test",
        monthlyPriceCents: 0,
        contentItemsPerMonth: 100,
        socialConnectionsLimit: 10,
        brandsLimit: 10,
        teamMembersLimit: 10,
      },
    });
    await prisma.subscription.create({ data: { workspaceId, planId: plan.id, status: "ACTIVE" } });
    await prisma.usageLimit.create({
      data: {
        workspaceId,
        contentItemsPerMonth: 100,
        socialConnectionsLimit: 10,
        brandsLimit: 10,
        teamMembersLimit: 10,
        monthlyBudgetCents: 10000,
      },
    });
    await prisma.brand.create({
      data: {
        id: brandId,
        workspaceId,
        name: "Riverbend Coffee",
        slug: "riverbend",
        industry: "Coffee",
        description: "Friendly local coffee roaster",
        productsServices: "Fresh coffee",
        targetCustomers: "Home brewers",
        geographicMarket: "Local",
        status: "ACTIVE",
        guidelines: {
          create: [
            { type: "CTA_STANDARD", content: "Invite one useful, low-pressure next action." },
            { type: "REQUIRED_DISCLAIMER", content: "Offers are subject to availability." },
          ],
        },
      },
    });
    await prisma.campaign.create({
      data: {
        id: campaignId,
        workspaceId,
        brandId,
        name: "Education",
        objective: "Teach home brewers about coffee",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        targetPlatforms: ["MOCK"],
      },
    });
    await prisma.renderTemplate.create({
      data: {
        key: "EDUCATIONAL_LIST",
        name: "Test template",
        description: "Scene rendering",
        config: {},
      },
    });
  });
  afterAll(async () => {
    await prisma.$disconnect();
    if (storageRoot.startsWith(join(tmpdir(), "contentforge-integration-media-")))
      await rm(storageRoot, { recursive: true, force: true });
  });
  it("allows only one of two independent database clients to reserve a task", async () => {
    const secondDb = new PrismaClient(),
      second = new PostgresTaskQueueProvider(secondDb);
    try {
      const task = job("concurrency");
      await queue.enqueue(task);
      await queue.enqueue({ ...task, id: randomUUID() });
      const claims = await Promise.all([
        queue.reserve(["concurrency"]),
        second.reserve(["concurrency"]),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      await queue.acknowledge(claims.find(Boolean)!);
      await second.enqueue({ ...task, id: randomUUID() });
      expect(await second.reserve(["concurrency"])).toBeNull();
    } finally {
      await secondDb.$disconnect();
    }
  });
  it("persists retry, dead letter, cancellation and lease fencing", async () => {
    const transient = job("transient");
    await queue.enqueue(transient);
    const handler = {
      transient: {
        execute: async () => {
          throw new Error("temporary");
        },
      },
    };
    await executeNextTask(queue, handler);
    expect(
      (await prisma.queuedTask.findUniqueOrThrow({ where: { id: transient.id } })).status,
    ).toBe("RETRYING");
    await prisma.queuedTask.update({
      where: { id: transient.id },
      data: { scheduledAt: new Date(0) },
    });
    await executeNextTask(queue, handler);
    expect(
      (await prisma.queuedTask.findUniqueOrThrow({ where: { id: transient.id } })).status,
    ).toBe("DEAD_LETTER");
    const permanent = job("permanent");
    await queue.enqueue(permanent);
    await executeNextTask(queue, {
      permanent: {
        execute: async () => {
          throw new PermanentTaskError("bad payload");
        },
      },
    });
    expect(
      (await prisma.queuedTask.findUniqueOrThrow({ where: { id: permanent.id } })).attemptCount,
    ).toBe(1);
    const cancelled = job("cancel");
    await queue.enqueue(cancelled);
    const claim = (await queue.reserve(["cancel"]))!;
    await queue.cancel(claim.id, workspaceId);
    await queue.acknowledge(claim);
    expect((await prisma.queuedTask.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe(
      "CANCELLED",
    );
    const expired = job("expired");
    await queue.enqueue(expired);
    const first = (await queue.reserve(["expired"]))!;
    await prisma.queuedTask.update({
      where: { id: first.id },
      data: { leaseExpiresAt: new Date(0) },
    });
    const second = (await queue.reserve(["expired"]))!;
    await queue.acknowledge(first);
    expect(await queue.heartbeat(second)).toBe(true);
    await queue.acknowledge(second);
  });
  it("runs strategy → ideas → script/critique → media/MP4 → approval → scheduled mock publish → analytics", async () => {
    const strategyInput = {
      workspaceId,
      userId,
      campaignId,
      operation: "strategy" as const,
      idempotencyKey: "strategy-test",
    };
    const [a, b] = await Promise.all([
      startGeneration(strategyInput),
      startGeneration(strategyInput),
    ]);
    expect(a.id).toBe(b.id);
    expect(await executeNextTask(queue, registry, { onFailure: recordTaskFailure })).toBe(true);
    expect((await prisma.workflowRun.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "SUCCEEDED",
    );
    await startGeneration({ ...strategyInput, operation: "ideas", idempotencyKey: "ideas-test" });
    await executeNextTask(queue, registry, { onFailure: recordTaskFailure });
    const ideas = await prisma.contentIdea.findMany({ where: { campaignId } });
    expect(ideas).toHaveLength(5);
    const idea = ideas.find((i) => i.format === "SHORT_VIDEO_9X16")!;
    const content = await prisma.contentItem.create({
      data: {
        workspaceId,
        brandId,
        campaignId,
        contentIdeaId: idea.id,
        title: idea.title,
        primaryFormat: idea.format,
        createdByUserId: userId,
      },
    });
    const production = await startGeneration({
      workspaceId,
      userId,
      contentItemId: content.id,
      operation: "script",
      idempotencyKey: "production-test",
    });
    for (let i = 0; i < 5; i++)
      expect(await executeNextTask(queue, registry, { onFailure: recordTaskFailure })).toBe(true);
    const run = await prisma.workflowRun.findUniqueOrThrow({
      where: { id: production.id },
      include: { steps: true, tasks: true },
    });
    expect(run.errorMessage).toBeNull();
    expect(run.status).toBe("SUCCEEDED");
    expect(run.steps.some((s) => s.agentName === "BrandCriticAgent")).toBe(true);
    expect(run.tasks.every((t) => t.status === "COMPLETED")).toBe(true);
    const rendered = await prisma.renderedAsset.findFirstOrThrow({
      where: { renderJob: { workspaceId, contentVariant: { contentItemId: content.id } } },
    });
    const bytes = await new LocalObjectStorageProvider(storageRoot).get(rendered.storageKey);
    expect(Buffer.from(bytes).toString("ascii", 4, 8)).toBe("ftyp");
    expect(bytes.length).toBeGreaterThan(10000);
    expect(
      await prisma.mediaAsset.count({
        where: {
          workspaceId,
          workflowRunId: production.id,
          checksumSha256: { not: "" },
          generationJobId: { not: null },
        },
      }),
    ).toBeGreaterThanOrEqual(6);
    for (const asset of await prisma.mediaAsset.findMany({
      where: { workspaceId, workflowRunId: production.id },
    })) {
      const actual = await new LocalObjectStorageProvider(storageRoot).get(asset.storageKey);
      expect(createHash("sha256").update(actual).digest("hex")).toBe(asset.checksumSha256);
    }
    const connection = await prisma.socialConnection.create({
      data: {
        workspaceId,
        platform: "MOCK",
        externalUserId: suffix,
        connectedByUserId: userId,
        scopes: ["publish"],
      },
    });
    const account = await prisma.socialAccount.create({
      data: {
        workspaceId,
        socialConnectionId: connection.id,
        platform: "MOCK",
        externalAccountId: suffix,
        displayName: "Mock account",
        capabilities: {},
      },
    });
    const publish = {
      workspaceId,
      userId,
      contentItemId: content.id,
      socialAccountId: account.id,
      scheduledAt: new Date(Date.now() + 60_000),
      idempotencyKey: "publish-test",
    };
    await expect(scheduleOrPublish(publish)).rejects.toThrow("approved");
    const review = await prisma.approvalRequest.findFirstOrThrow({
      where: { contentItemId: content.id, status: "PENDING" },
    });
    await decideApproval({
      workspaceId,
      userId,
      approvalRequestId: review.id,
      decision: "APPROVED",
      complianceAcknowledged: true,
    });
    await expect(
      decideApproval({
        workspaceId,
        userId,
        approvalRequestId: review.id,
        decision: "APPROVED",
        complianceAcknowledged: true,
      }),
    ).rejects.toThrow("latest");
    const [scheduled, replay] = await Promise.all([
      scheduleOrPublish(publish),
      scheduleOrPublish(publish),
    ]);
    expect(scheduled.job.id).toBe(replay.job.id);
    expect(await queue.reserve(["publish.content"])).toBeNull();
    await prisma.queuedTask.updateMany({
      where: { workspaceId, type: "publish.content", status: "QUEUED" },
      data: { scheduledAt: new Date(0) },
    });
    await executeNextTask(queue, registry, { onFailure: recordTaskFailure });
    await executeNextTask(queue, registry, { onFailure: recordTaskFailure });
    expect((await prisma.contentItem.findUniqueOrThrow({ where: { id: content.id } })).status).toBe(
      "PUBLISHED",
    );
    expect(await prisma.publishedPost.count({ where: { publishJobId: scheduled.job.id } })).toBe(1);
    expect(await prisma.analyticsSnapshot.count({ where: { workspaceId } })).toBe(1);
  });
  it("cancels a persisted workflow and rejects cross-workspace cancellation", async () => {
    const run = await startGeneration({
      workspaceId,
      userId,
      campaignId,
      operation: "strategy",
      idempotencyKey: "cancel-workflow",
    });
    await expect(cancelWorkflow("another-workspace", run.id, userId)).rejects.toThrow();
    await cancelWorkflow(workspaceId, run.id, userId);
    expect((await prisma.workflowRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe(
      "CANCELLED",
    );
    expect(await queue.reserve(["generation.strategy"])).toBeNull();
  });
});
