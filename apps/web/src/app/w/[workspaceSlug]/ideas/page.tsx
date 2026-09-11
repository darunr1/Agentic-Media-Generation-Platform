import { notFound } from "next/navigation";
import { Clock3, Lightbulb, WandSparkles } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function IdeasPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const ideas = await prisma.contentIdea.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    include: { pillar: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Mock AI · structured output"
        title="Idea board"
        description="Five validated concepts generated from the campaign strategy and BrandContext. Every idea includes production scope, novelty, and compliance notes."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {ideas.map((idea, index) => (
          <Card key={idea.id} className={index === 0 ? "border-primary/50 bg-primary/[.04]" : ""}>
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <span className="bg-primary/10 text-primary rounded-lg p-2">
                  <Lightbulb className="size-4" />
                </span>
                <div className="flex gap-2">
                  <Badge variant={idea.status === "ACCEPTED" ? "success" : "secondary"}>
                    {idea.status}
                  </Badge>
                  <Badge variant="outline">{idea.targetPlatform}</Badge>
                </div>
              </div>
              <h2 className="text-lg font-semibold">{idea.title}</h2>
              <p className="text-primary mt-2 text-sm font-medium">“{idea.hook}”</p>
              <p className="text-muted-foreground mt-3 text-sm leading-6">{idea.mainTakeaway}</p>
              <div className="text-muted-foreground mt-5 flex flex-wrap gap-4 text-xs">
                <span>{idea.pillar?.name ?? "Unassigned"}</span>
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  {idea.estimatedDurationSeconds ?? 0}s
                </span>
                <span className="flex items-center gap-1">
                  <WandSparkles className="size-3.5" />
                  {idea.productionDifficulty}
                </span>
                <span>{idea.format.replaceAll("_", " ")}</span>
              </div>
              {idea.complianceNotes && (
                <p className="mt-4 rounded-lg bg-amber-400/10 p-3 text-xs text-amber-200">
                  {idea.complianceNotes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
