import { cache } from "react";

import { prisma } from "@contentforge/database";
import { auth, listUserWorkspaceMemberships } from "@contentforge/auth";

export interface WorkspaceContext {
  workspace: NonNullable<Awaited<ReturnType<typeof prisma.workspace.findUnique>>>;
  role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "VIEWER";
  userId: string;
  memberships: Awaited<ReturnType<typeof listUserWorkspaceMemberships>>;
}

/**
 * Resolves + authorizes a workspace-scoped request in one place, deduped
 * per-request via React `cache()` so the layout and every nested page can
 * call this without re-querying. Returns `null` on any failure — no
 * workspace with that slug, or the signed-in user isn't a member — so
 * callers render a generic not-found rather than distinguishing "doesn't
 * exist" from "no access" (that distinction is itself an information leak).
 */
export const getWorkspaceContext = cache(
  async (workspaceSlug: string): Promise<WorkspaceContext | null> => {
    const session = await auth();
    if (!session?.user?.id) return null;

    const [workspace, memberships] = await Promise.all([
      prisma.workspace.findUnique({ where: { slug: workspaceSlug } }),
      listUserWorkspaceMemberships(session.user.id),
    ]);
    if (!workspace || workspace.deletedAt) return null;

    const membership = memberships.find((m) => m.workspaceId === workspace.id);
    if (!membership) return null;

    return {
      workspace,
      role: membership.role,
      userId: session.user.id,
      memberships,
    };
  },
);
