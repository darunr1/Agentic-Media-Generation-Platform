import { notFound } from "next/navigation";
import { prisma } from "@contentforge/database";
import { PageHeading } from "@/components/product/page-heading";
import { PlatformGrid } from "@/components/product/platform-grid";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  await prisma.socialConnection.count({ where: { workspaceId: ctx.workspace.id } });
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Official APIs only"
        title="Social connections"
        description="OAuth tokens are encrypted at rest, scoped minimally, never returned to the browser, and can be revoked. Unsupported capabilities stay visible and honest."
      />
      <PlatformGrid />
    </div>
  );
}
