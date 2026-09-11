import { notFound } from "next/navigation";
import { BookOpen, FileText, Globe2, ShieldCheck } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const sources = await prisma.knowledgeSource.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    include: { _count: { select: { chunks: true } } },
  });
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Brand knowledge"
        title="Trusted source library"
        description="Manual notes, documents, catalogs, and safe webpage imports become cited context for generation. Imported text is always treated as untrusted data."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Feature
          icon={FileText}
          title="Documents"
          text="TXT, Markdown, PDF and CSV with file and magic-byte limits."
        />
        <Feature
          icon={Globe2}
          title="Web importer"
          text="Public URLs only, with SSRF protection, robots checks and strict timeouts."
        />
        <Feature
          icon={ShieldCheck}
          title="Prompt-safe"
          text="Scripts and instructions are stripped before content enters the context builder."
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge sources</CardTitle>
        </CardHeader>
        <CardContent>
          {sources.length ? (
            <ul className="divide-border divide-y">
              {sources.map((source) => (
                <li key={source.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary rounded-lg p-2">
                      <BookOpen className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium">{source.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {source.type.replaceAll("_", " ")} · {source._count.chunks} indexed chunk
                        {source._count.chunks === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">{source.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No knowledge sources yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icon className="text-primary mb-4 size-5" />
        <h3 className="font-medium">{title}</h3>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{text}</p>
      </CardContent>
    </Card>
  );
}
