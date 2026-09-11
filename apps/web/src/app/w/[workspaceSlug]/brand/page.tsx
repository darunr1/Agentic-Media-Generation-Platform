import { notFound } from "next/navigation";
import { prisma } from "@contentforge/database";
import { BrandSummary } from "@/components/product/brand-summary";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function BrandPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const brand = await prisma.brand.findFirst({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    include: { brandVoice: true, guidelines: true },
  });
  if (!brand) return <div>No brand profile yet. Complete onboarding to create one.</div>;
  return <BrandSummary brand={brand} />;
}
