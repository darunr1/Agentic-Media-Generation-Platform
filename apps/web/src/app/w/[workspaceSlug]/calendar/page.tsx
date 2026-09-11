import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function CalendarPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const items = await prisma.contentItem.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      OR: [{ scheduledAt: { not: null } }, { status: "PUBLISHED" }],
    },
    include: { variants: { include: { publishJobs: { include: { publishedPost: true } } } } },
    orderBy: { scheduledAt: "asc" },
  });
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Publishing"
        title="Content calendar"
        description="Approved content is scheduled in the workspace timezone. Invalid or past dates are rejected before a publish job is created."
      />
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="grid items-center gap-4 p-5 sm:grid-cols-[64px_1fr_auto]">
              <div className="bg-primary/10 text-primary flex size-12 flex-col items-center justify-center rounded-xl">
                <span className="text-[10px] uppercase">
                  {(item.scheduledAt ?? item.createdAt).toLocaleString("en", { month: "short" })}
                </span>
                <span className="text-lg font-semibold">
                  {(item.scheduledAt ?? item.createdAt).getDate()}
                </span>
              </div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  <CalendarClock className="size-3.5" />
                  {item.scheduledAt?.toLocaleString() ??
                    item.variants
                      .flatMap((v) => v.publishJobs)
                      .find((j) => j.publishedPost)
                      ?.publishedPost?.publishedAt.toLocaleString() ??
                    "Published"}
                </p>
              </div>
              <Badge variant={item.status === "PUBLISHED" ? "success" : "warning"}>
                {item.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
