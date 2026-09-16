import { assertWorkspaceMembership } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { NextResponse } from "next/server";
import { getAnalytics, analyticsCsv } from "@/server/services/analytics-service";
export const GET = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspaceMembership(userId, w.id);
  const query = Object.fromEntries([...req.nextUrl.searchParams].filter(([, v]) => v));
  const result = await getAnalytics(w.id, query);
  if (query.format === "csv")
    return new NextResponse(analyticsCsv(result.rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="contentforge-analytics.csv"',
      },
    });
  return jsonOk(result);
});
