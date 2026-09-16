import { notFound } from "next/navigation";
import { prisma } from "@contentforge/database";
import { hasPermission } from "@contentforge/auth";
import { scriptSchema, type ScriptOutput } from "@contentforge/ai";
import { LocalObjectStorageProvider, localStorageRoot } from "@contentforge/media";
import { Badge, Card, CardContent } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
import { ActionButton, RecordForm, ScheduleForm } from "@/components/product/workflow-actions";
import { ScriptEditor } from "@/components/product/script-editor";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ contentId?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { contentId } = await searchParams;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const contents = await prisma.contentItem.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const content = await prisma.contentItem.findFirst({
    where: {
      workspaceId: ctx.workspace.id,
      deletedAt: null,
      ...(contentId ? { id: contentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      variants: {
        where: { isPrimary: true, deletedAt: null },
        include: {
          script: {
            include: { scenes: { orderBy: { sequenceNumber: "asc" } }, captionTracks: true },
          },
          renderJobs: {
            where: { status: "SUCCEEDED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { outputs: true },
          },
        },
      },
      workflowRuns: { orderBy: { createdAt: "desc" }, take: 10 },
      comments: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!content)
    return (
      <div className="space-y-4">
        <PageHeading
          title="Content Studio"
          description="Accept a short video idea to start production."
        />
        <a href={`/w/${workspaceSlug}/ideas`} className="text-primary underline">
          Open idea board
        </a>
      </div>
    );
  const variant = content.variants[0],
    saved = variant?.script,
    output = variant?.renderJobs[0]?.outputs[0];
  const parsed = scriptSchema.safeParse(saved?.modelMetadata);
  const script: ScriptOutput | undefined = parsed.success
    ? parsed.data
    : saved
      ? {
          openingHook: saved.openingHook,
          spokenNarration: saved.narration,
          callToAction: saved.cta,
          caption: saved.caption,
          onScreenText: saved.onScreenText ? [saved.onScreenText] : [],
          sceneDescriptions: [],
          bRollSuggestions: [],
          estimatedDurationSeconds: (saved.scenes.at(-1)?.endTimeMs ?? 24000) / 1000,
          titleAlternatives:
            saved.titleAlternatives.length >= 2
              ? saved.titleAlternatives
              : [content.title, content.title + " guide"],
          hashtags: saved.hashtags,
          thumbnailText: saved.thumbnailText ?? content.title,
          platformVariants: [
            {
              platform: variant!.platform,
              title: content.title,
              caption: variant!.captionText ?? saved.caption,
              hashtags: saved.hashtags,
            },
          ],
          scenes: saved.scenes.map((s) => ({
            sequenceNumber: s.sequenceNumber,
            startSeconds: s.startTimeMs / 1000,
            endSeconds: s.endTimeMs / 1000,
            narration: s.narration,
            onScreenText: s.onScreenText ?? "",
            visualPrompt: s.visualPrompt,
            assetType: "GENERATED_BACKGROUND",
            transition: "fade",
            motionInstruction: s.motionInstruction ?? "",
            audioInstruction: s.audioInstruction ?? "",
            safeAreaPosition: "CENTER",
            sourceAttribution: s.sourceAttribution,
          })),
        }
      : undefined;
  const storage = new LocalObjectStorageProvider(localStorageRoot());
  const videoUrl = output
    ? await storage.createSignedDownloadUrl(output.storageKey, 3600)
    : undefined;
  const caption = saved?.captionTracks.find((t) => t.format === "WEBVTT");
  const captionUrl = caption
    ? await storage.createSignedDownloadUrl(caption.storageKey, 3600)
    : undefined;
  const versions = await prisma.contentVersion.findMany({
    where: { workspaceId: ctx.workspace.id, contentItemId: content.id },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: ctx.workspace.id, isActive: true, platform: "MOCK" },
    select: { id: true, displayName: true },
  });
  const active = content.workflowRuns.some((r) =>
    ["PENDING", "RUNNING", "WAITING"].includes(r.status),
  );
  const editable =
    !active &&
    ["DRAFT", "AWAITING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "FAILED"].includes(
      content.status,
    );
  return (
    <div className="space-y-6">
      <PageHeading
        title={content.title}
        description="Generate, edit, review and render a short video. Mock audio is a reference tone, not human speech."
      />
      <nav aria-label="Content items" className="flex flex-wrap gap-3">
        {contents.map((c) => (
          <a
            className="text-primary text-sm underline"
            href={`/w/${workspaceSlug}/studio?contentId=${c.id}`}
            key={c.id}
          >
            {c.title}
          </a>
        ))}
      </nav>
      <div className="flex flex-wrap gap-3">
        <Badge>{content.status}</Badge>
        {hasPermission(ctx.role, "content:generate") && editable && (
          <ActionButton
            url={`/api/v1/workspaces/${workspaceSlug}/generations/script`}
            body={{ contentItemId: content.id, preserveScript: !!script }}
          >
            {" "}
            {script ? "Review and render saved script" : "Generate script and video"}
          </ActionButton>
        )}
        <a className="text-primary text-sm underline" href={`/w/${workspaceSlug}/approvals`}>
          Open approval queue
        </a>
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          {videoUrl ? (
            <video
              aria-label="Rendered content preview"
              controls
              preload="metadata"
              src={videoUrl}
              className="w-full rounded-xl"
            >
              {captionUrl && (
                <track kind="captions" src={captionUrl} srcLang="en" label="English" default />
              )}
            </video>
          ) : (
            <div className="rounded-xl border p-6 text-sm">
              No rendered video yet. Start generation and follow the workflow below.
            </div>
          )}
          {content.status === "APPROVED" && hasPermission(ctx.role, "publish:execute") && (
            <ScheduleForm
              workspaceSlug={workspaceSlug}
              contentId={content.id}
              accounts={accounts}
            />
          )}
          <Card>
            <CardContent className="space-y-2 p-4">
              <h2 className="font-semibold">Workflow history</h2>
              {content.workflowRuns.map((r) => (
                <a
                  className="text-primary block text-sm underline"
                  href={`/w/${workspaceSlug}/workflows/${r.id}`}
                  key={r.id}
                >
                  {r.type} / {r.status}
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-5">
            {script ? (
              hasPermission(ctx.role, "content:write") && editable ? (
                <ScriptEditor
                  key={saved?.updatedAt.toISOString()}
                  initial={script}
                  workspaceSlug={workspaceSlug}
                  contentId={content.id}
                />
              ) : (
                <pre className="max-h-[700px] overflow-auto whitespace-pre-wrap text-sm">
                  {JSON.stringify(script, null, 2)}
                </pre>
              )
            ) : (
              <p>The script and scene plan will appear after generation.</p>
            )}
          </CardContent>
        </Card>
      </div>
      {versions.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">Before / after versions</summary>
          <div className="grid gap-4 md:grid-cols-2">
            {[...versions].reverse().map((v, i) => (
              <div key={v.id}>
                <h3>
                  {i === 0 && versions.length > 1 ? "Before" : "Latest"} /{" "}
                  {v.createdAt.toLocaleString()}
                </h3>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border p-4 text-xs">
                  {JSON.stringify(v.snapshot, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Comments</h2>
        {content.comments.map((c) => (
          <p className="rounded-xl border p-3 text-sm" key={c.id}>
            {c.body}
          </p>
        ))}
        {hasPermission(ctx.role, "content:comment") && (
          <RecordForm
            url={`/api/v1/workspaces/${workspaceSlug}/content/${content.id}/comments`}
            fields={[{ name: "body", label: "Comment", type: "textarea" }]}
            label="Add comment"
          />
        )}
      </section>
    </div>
  );
}
