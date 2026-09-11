import { notFound } from "next/navigation";
import { Bell, CheckCircle2 } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const items = await prisma.notification.findMany({
    where: { workspaceId: ctx.workspace.id, OR: [{ userId: ctx.userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Inbox"
        title="Notifications"
        description="Review, publishing, social authorization, billing, usage, and monthly report events appear here and respect email preferences."
      />
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className={item.readAt ? "opacity-70" : "border-primary/30"}>
              <CardContent className="flex gap-4 p-5">
                <span className="bg-primary/10 text-primary rounded-lg p-2">
                  {item.readAt ? <CheckCircle2 className="size-4" /> : <Bell className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{item.title}</p>
                    <Badge variant={item.readAt ? "secondary" : "default"}>
                      {item.type.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{item.body}</p>
                  <time className="text-muted-foreground mt-2 block text-xs">
                    {item.createdAt.toLocaleString()}
                  </time>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-10 text-center">
            <Bell className="text-muted-foreground mx-auto mb-3 size-6" />
            <p className="font-medium">You’re all caught up</p>
            <p className="text-muted-foreground mt-1 text-sm">
              New workflow and account events will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
