import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/server/services/workspace-context";
import { getAnalytics } from "@/server/services/analytics-service";
import { prisma } from "@contentforge/database";
import { PageHeading } from "@/components/product/page-heading";
export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const query = Object.fromEntries(
    Object.entries(await searchParams).filter((entry): entry is [string, string] => !!entry[1]),
  );
  const parsed = await getAnalytics(ctx.workspace.id, query);
  const contents = await prisma.contentItem.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    select: { id: true, title: true },
  });
  const csv = new URLSearchParams({ ...query, format: "csv" });
  return (
    <div className="space-y-6">
      <PageHeading
        title="Analytics"
        description="Latest cumulative snapshot per post in the selected period. Mock metrics are labeled; missing metrics stay unavailable."
      />
      <form className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          From
          <input
            className="bg-background block rounded border p-2"
            type="date"
            name="from"
            defaultValue={query.from}
          />
        </label>
        <label className="text-sm">
          Through
          <input
            className="bg-background block rounded border p-2"
            type="date"
            name="to"
            defaultValue={query.to}
          />
        </label>
        <label className="text-sm">
          Platform
          <select
            className="bg-background block rounded border p-2"
            name="platform"
            defaultValue={query.platform ?? ""}
          >
            <option value="">All platforms</option>
            {["MOCK", "INSTAGRAM", "FACEBOOK", "YOUTUBE", "TIKTOK", "THREADS", "X"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Content
          <select
            className="bg-background block rounded border p-2"
            name="contentId"
            defaultValue={query.contentId ?? ""}
          >
            <option value="">All content</option>
            {contents.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <button className="bg-primary text-primary-foreground rounded px-4 py-2">
          Apply filters
        </button>
        <a
          className="text-primary underline"
          href={`/api/v1/workspaces/${workspaceSlug}/analytics?${csv}`}
        >
          Export CSV
        </a>
      </form>
      <div className="grid gap-4 sm:grid-cols-4">
        {Object.entries(parsed.totals).map(([key, value]) => (
          <div className="rounded-xl border p-5" key={key}>
            <p className="capitalize">{key}</p>
            <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-3 text-left">
            {parsed.rows.length} posts. Completion rates retain provider definitions.
          </caption>
          <thead>
            <tr>
              {["Content", "Platform", "Views", "Completion", "Captured"].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((r) => (
              <tr className="border-t" key={r.postId}>
                <td className="p-2">{r.title}</td>
                <td className="p-2">{r.platform === "MOCK" ? "MOCK (fixture)" : r.platform}</td>
                <td className="p-2">{r.views ?? "Unavailable"}</td>
                <td className="p-2">
                  {r.completionRate === null
                    ? "Unavailable"
                    : `${(r.completionRate * 100).toFixed(1)}%`}
                </td>
                <td className="p-2">{new Date(r.capturedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Evidence-based recommendations</h2>
        {parsed.recommendations.length ? (
          parsed.recommendations.map((r) => (
            <div key={r.evidence.snapshotId} className="rounded-xl border p-4">
              <p>{r.message}</p>
              <p className="text-muted-foreground mt-2 text-xs">
                Evidence: snapshot {r.evidence.snapshotId}; {r.evidence.capturedAt}
              </p>
            </div>
          ))
        ) : (
          <p>No completion-rate data is available in this selection.</p>
        )}
      </section>
      {parsed.truncated && (
        <p>Narrow the date range: the 10,000-snapshot safety limit was reached.</p>
      )}
    </div>
  );
}
