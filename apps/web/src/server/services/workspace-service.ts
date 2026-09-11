import { prisma } from "@contentforge/database";
import type { Workspace } from "@contentforge/database";
import { ValidationError, loadEnv, newId, slugify } from "@contentforge/shared";
import { getPlanDefinition } from "@contentforge/shared";

import { recordAuditLog } from "./audit-service";

const TRIAL_LENGTH_DAYS = 14;

export interface CreateWorkspaceInput {
  userId: string;
  name: string;
}

async function uniqueSlugFor(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;
  // Small, bounded loop — workspace creation is a low-frequency, user-driven
  // action, so a handful of existence checks is an acceptable cost for a
  // human-readable slug instead of a random suffix on every collision.
  while (
    await prisma.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
    if (suffix > 50) {
      candidate = `${base}-${newId().slice(0, 6)}`;
      break;
    }
  }
  return candidate;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new ValidationError("Workspace name must be at least 2 characters");
  }

  const env = loadEnv();
  const slug = await uniqueSlugFor(name);
  const starterPlan = getPlanDefinition("starter");
  const trialEndsAt = new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);

  const workspace = await prisma.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: {
        name,
        slug,
        createdByUserId: input.userId,
        memberships: {
          create: { userId: input.userId, role: "OWNER" },
        },
      },
    });

    const plan = await tx.plan.upsert({
      where: { key: starterPlan.key },
      update: {},
      create: {
        key: starterPlan.key,
        name: starterPlan.name,
        monthlyPriceCents: starterPlan.monthlyPriceCents,
        contentItemsPerMonth: starterPlan.contentItemsPerMonth,
        socialConnectionsLimit: starterPlan.socialConnectionsLimit,
        brandsLimit: starterPlan.brandsLimit,
        teamMembersLimit: starterPlan.teamMembersLimit,
        hasAnalytics: starterPlan.hasAnalytics,
        hasCalendar: starterPlan.hasCalendar,
        hasCustomTemplates: starterPlan.hasCustomTemplates,
        hasClientApprovalLinks: starterPlan.hasClientApprovalLinks,
        priorityRendering: starterPlan.priorityRendering,
      },
    });

    await tx.subscription.create({
      data: {
        workspaceId: created.id,
        planId: plan.id,
        status: "TRIALING",
        trialEndsAt,
      },
    });

    await tx.usageLimit.create({
      data: {
        workspaceId: created.id,
        contentItemsPerMonth: plan.contentItemsPerMonth,
        socialConnectionsLimit: plan.socialConnectionsLimit,
        brandsLimit: plan.brandsLimit,
        teamMembersLimit: plan.teamMembersLimit,
        monthlyBudgetCents: env.DEFAULT_WORKSPACE_MONTHLY_BUDGET_CENTS,
        budgetWarningPct: env.DEFAULT_WORKSPACE_BUDGET_WARNING_PCT,
      },
    });

    await recordAuditLog(
      {
        workspaceId: created.id,
        actorUserId: input.userId,
        action: "workspace.created",
        targetType: "Workspace",
        targetId: created.id,
        metadata: { name, slug },
      },
      tx,
    );

    return created;
  });

  return workspace;
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({ where: { slug } });
}

export async function renameWorkspace(
  workspaceId: string,
  name: string,
  actorUserId: string,
): Promise<Workspace> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new ValidationError("Workspace name must be at least 2 characters");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workspace.update({
      where: { id: workspaceId },
      data: { name: trimmed },
    });
    await recordAuditLog(
      {
        workspaceId,
        actorUserId,
        action: "workspace.renamed",
        targetType: "Workspace",
        targetId: workspaceId,
        metadata: { name: trimmed },
      },
      tx,
    );
    return updated;
  });
}

/**
 * Soft-deletes a workspace (brief §14 "data deletion workflow"). The
 * workspace immediately stops resolving for every member —
 * `getWorkspaceContext`/`listUserWorkspaceMemberships` both filter on
 * `deletedAt: null` — while the row and its children are retained for the
 * grace period. Permanent removal (including deleting the underlying object
 * storage files) is a scheduled sweep job that belongs to the worker
 * (packages/workflows, built in Phase 5); wiring the actual cron trigger is
 * tracked there rather than duplicated here.
 */
export async function softDeleteWorkspace(workspaceId: string, actorUserId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
    await recordAuditLog(
      {
        workspaceId,
        actorUserId,
        action: "workspace.deleted",
        targetType: "Workspace",
        targetId: workspaceId,
      },
      tx,
    );
  });
}
