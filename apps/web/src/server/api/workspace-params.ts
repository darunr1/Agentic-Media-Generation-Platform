import { prisma } from "@contentforge/database";
import { NotFoundError } from "@contentforge/shared";

/** Resolves a `[workspaceSlug]` route param to a workspace id, or throws a
 * NotFoundError — used at the top of every workspace-scoped API route
 * before an `assertWorkspacePermission` call. */
export async function resolveWorkspaceOrThrow(workspaceSlug: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  });
  if (!workspace) {
    throw new NotFoundError("Workspace", workspaceSlug);
  }
  return workspace;
}
