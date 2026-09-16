import { prisma } from "@contentforge/database";
import { z } from "zod";

export const analyticsFilterSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    platform: z
      .enum(["MOCK", "INSTAGRAM", "YOUTUBE", "FACEBOOK", "THREADS", "TIKTOK", "X"])
      .optional(),
    contentId: z.string().min(1).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, "Start date must precede end date");
export async function getAnalytics(workspaceId: string, query: unknown) {
  const filters = analyticsFilterSchema.parse(query);
  const end = filters.to ? new Date(filters.to.getTime() + 86_400_000) : undefined;
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      workspaceId,
      capturedAt: { gte: filters.from, lt: end },
      publishedPost: {
        workspaceId,
        platform: filters.platform,
        publishJob: { contentVariant: { contentItemId: filters.contentId } },
      },
    },
    include: {
      publishedPost: {
        include: {
          publishJob: { include: { contentVariant: { include: { contentItem: true } } } },
        },
      },
    },
    orderBy: { capturedAt: "desc" },
    take: 10_000,
  });
  // Provider snapshots are cumulative. Count each post once, using its latest snapshot in range.
  const byPost = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots)
    if (!byPost.has(snapshot.publishedPostId)) byPost.set(snapshot.publishedPostId, snapshot);
  const latest = [...byPost.values()];
  const rows = latest.map((s) => ({
    postId: s.publishedPostId,
    snapshotId: s.id,
    title: s.publishedPost.publishJob.contentVariant.contentItem.title,
    platform: s.publishedPost.platform,
    capturedAt: s.capturedAt.toISOString(),
    views: s.views,
    likes: s.likes,
    shares: s.shares,
    saves: s.saves,
    clicks: s.clicks,
    completionRate: s.completionRate,
  }));
  const totals = rows.reduce(
    (a, r) => ({
      views: a.views + (r.views ?? 0),
      likes: a.likes + (r.likes ?? 0),
      shares: a.shares + (r.shares ?? 0),
      clicks: a.clicks + (r.clicks ?? 0),
    }),
    { views: 0, likes: 0, shares: 0, clicks: 0 },
  );
  const eligible = rows
    .filter((r) => r.completionRate !== null)
    .sort((a, b) => b.completionRate! - a.completionRate!);
  const best = eligible[0];
  const recommendations = best
    ? [
        {
          message: `Test another video based on “${best.title}”: its observed completion rate was ${(best.completionRate! * 100).toFixed(1)}%, the highest among ${eligible.length} posts with completion data in this selection. This is a descriptive observation, not a causal claim.`,
          evidence: {
            snapshotId: best.snapshotId,
            postId: best.postId,
            completionRate: best.completionRate,
            sampleSize: eligible.length,
            capturedAt: best.capturedAt,
          },
        },
      ]
    : [];
  return { rows, totals, recommendations, truncated: snapshots.length === 10_000 };
}
export function analyticsCsv(rows: Awaited<ReturnType<typeof getAnalytics>>["rows"]) {
  const columns = [
    "postId",
    "title",
    "platform",
    "capturedAt",
    "views",
    "likes",
    "shares",
    "saves",
    "clicks",
    "completionRate",
  ] as const;
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join(
    "\r\n",
  );
}
