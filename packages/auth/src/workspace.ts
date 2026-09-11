import { prisma } from "@contentforge/database";
import type { WorkspaceMembership } from "@contentforge/database";
import { ForbiddenError, UnauthenticatedError } from "@contentforge/shared";

import type { Permission } from "./permissions";
import { hasPermission } from "./permissions";

/**
 * The single choke point every route handler / server action uses to prove
 * a user belongs to the workspace they're about to touch. Centralizing this
 * (rather than each handler writing its own `where: { workspaceId }` check)
 * is the primary defense against broken workspace isolation / IDOR bugs
 * called out in SECURITY.md.
 */
export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMembership | null> {
  return prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function assertWorkspaceMembership(
  userId: string | undefined | null,
  workspaceId: string,
): Promise<WorkspaceMembership> {
  if (!userId) {
    throw new UnauthenticatedError();
  }
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    // 403, not 404 — an authenticated user gets a clear "no access" rather
    // than leaking whether the workspace id exists at all.
    throw new ForbiddenError("You are not a member of this workspace");
  }
  return membership;
}

export async function assertWorkspacePermission(
  userId: string | undefined | null,
  workspaceId: string,
  permission: Permission,
): Promise<WorkspaceMembership> {
  const membership = await assertWorkspaceMembership(userId, workspaceId);
  if (!hasPermission(membership.role, permission)) {
    throw new ForbiddenError(`Role ${membership.role} does not have permission '${permission}'`);
  }
  return membership;
}

export async function listUserWorkspaceMemberships(userId: string) {
  return prisma.workspaceMembership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
}
