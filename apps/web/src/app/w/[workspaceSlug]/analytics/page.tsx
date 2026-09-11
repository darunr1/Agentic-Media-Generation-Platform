import { notFound } from "next/navigation";
import { ArrowUpRight, Eye, Heart, MousePointerClick, Share2 } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      publishedPost: {
        include: {
          publishJob: { include: { contentVariant: { include: { contentItem: true } } } },
        },
      },
    },
    orderBy: { capturedAt: "desc" },
  });
  const totals = snapshots.reduce(
    (a, s) => ({
      views: a.views + (s.views ?? 0),
      likes: a.likes + (s.likes ?? 0),
      shares: a.shares + (s.shares ?? 0),
      clicks: a.clicks + (s.clicks ?? 0),
    }),
    { views: 0, likes: 0, shares: 0, clicks: 0 },
  );
  const snapshot = snapshots[0];
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Evidence, not hype"
        title="Analytics"
        description="Normalized metrics retain their platform definitions. Recommendations are labeled as hypotheses until the sample is large enough."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Eye} label="Views" value={totals.views} />
        <Metric icon={Heart} label="Likes" value={totals.likes} />
        <Metric icon={Share2} label="Shares" value={totals.shares} />
        <Metric icon={MousePointerClick} label="Clicks" value={totals.clicks} />
      </div>
      {snapshot && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Latest post performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {snapshot.publishedPost.publishJob.contentVariant.contentItem.title}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {snapshot.publishedPost.platform} · captured{" "}
                    {snapshot.capturedAt.toLocaleString()}
                  </p>
                </div>
                <Badge variant="success">Published</Badge>
              </div>
              <div className="space-y-4">
                <Rate label="Completion rate" value={(snapshot.completionRate ?? 0) * 100} />
                <Rate
                  label="Reach / impressions"
                  value={((snapshot.reach ?? 0) / Math.max(snapshot.impressions ?? 1, 1)) * 100}
                />
                <Rate
                  label="Save rate"
                  value={((snapshot.saves ?? 0) / Math.max(snapshot.views ?? 1, 1)) * 100}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/[.05]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recommendation</CardTitle>
                <ArrowUpRight className="text-primary size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Hypothesis · low sample</Badge>
              <p className="mt-4 font-medium">Reuse the three-step teaching structure</p>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                Saves are strong relative to views in the current sample. Test another short
                educational list before changing the hook style.
              </p>
              <p className="text-muted-foreground mt-4 text-xs">
                Based on {snapshots.length} published post{snapshots.length === 1 ? "" : "s"}; no
                statistical significance claimed.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
        </div>
        <Icon className="text-primary size-5" />
      </CardContent>
    </Card>
  );
}
function Rate({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <Progress value={Math.min(value, 100)} />
    </div>
  );
}
