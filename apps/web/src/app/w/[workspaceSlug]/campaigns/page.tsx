import { notFound } from "next/navigation";
import { CalendarRange, Target } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    include: { pillars: true, _count: { select: { ideas: true, contentItems: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Strategy"
        title="Campaigns"
        description="Deterministic monthly plans connect business objectives to content pillars, platform mix, measurable outcomes, and compliance risks."
      />
      {campaigns.map((campaign) => (
        <Card key={campaign.id}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="success">{campaign.status}</Badge>
                {campaign.targetPlatforms.map((platform) => (
                  <Badge key={platform} variant="outline">
                    {platform}
                  </Badge>
                ))}
              </div>
              <CardTitle>{campaign.name}</CardTitle>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm">{campaign.objective}</p>
            </div>
            <CalendarRange className="text-muted-foreground size-5" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {campaign.pillars.map((pillar) => (
                <div key={pillar.id} className="bg-secondary/30 rounded-xl p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-medium">{pillar.name}</p>
                    <span className="text-primary text-sm">{pillar.targetMixPercent ?? 0}%</span>
                  </div>
                  <Progress value={pillar.targetMixPercent ?? 0} />
                  <p className="text-muted-foreground mt-3 text-xs leading-5">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="text-muted-foreground mt-5 flex gap-5 text-xs">
              <span className="flex items-center gap-1">
                <Target className="size-3.5" />
                {campaign._count.ideas} ideas
              </span>
              <span>{campaign._count.contentItems} in production</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
