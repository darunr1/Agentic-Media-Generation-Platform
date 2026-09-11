import { notFound } from "next/navigation";
import { Film, Layers3, Subtitles, Volume2 } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";
import { ContentPreview } from "@/components/product/content-preview";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function StudioPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const content = await prisma.contentItem.findFirst({
    where: { workspaceId: ctx.workspace.id, variants: { some: { script: { isNot: null } } } },
    include: {
      variants: {
        include: {
          script: {
            include: {
              scenes: { orderBy: { sequenceNumber: "asc" } },
              voiceTracks: true,
              captionTracks: true,
            },
          },
          renderJobs: { include: { outputs: true } },
        },
      },
    },
  });
  if (!content) return <p>No generated content yet.</p>;
  const variant = content.variants[0]!;
  const script = variant.script!;
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Production workspace"
        title={content.title}
        description="Edit the script, scene timeline, captions, and platform variants. Rendering stays outside the web request lifecycle."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <ContentPreview
          title={script.thumbnailText ?? content.title}
          caption={variant.captionText ?? script.caption}
        />
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric icon={Film} label="Format" value="9:16 MP4" />
            <Metric icon={Layers3} label="Scenes" value={String(script.scenes.length)} />
            <Metric
              icon={Volume2}
              label="Voice"
              value={script.voiceTracks[0]?.providerName ?? "—"}
            />
            <Metric
              icon={Subtitles}
              label="Captions"
              value={script.captionTracks.map((track) => track.format).join(" + ")}
            />
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Script & caption</CardTitle>
              <Badge variant="outline">{script.promptVersion}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Opening hook
                </p>
                <p className="mt-2 text-lg font-medium">{script.openingHook}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Narration</p>
                <p className="mt-2 text-sm leading-6">{script.narration}</p>
              </div>
              <div className="rounded-xl border border-dashed p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Caption</p>
                <p className="mt-2 text-sm leading-6">{variant.captionText}</p>
                <p className="text-primary mt-2 text-xs">{variant.hashtags.join(" ")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Scene timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {script.scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[64px_1fr_auto]"
                >
                  <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg font-semibold">
                    {scene.sequenceNumber}
                  </div>
                  <div>
                    <p className="font-medium">{scene.onScreenText}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {scene.visualPrompt} · {scene.motionInstruction}
                    </p>
                  </div>
                  <Badge variant="secondary">{(scene.endTimeMs - scene.startTimeMs) / 1000}s</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Rendered variants</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {variant.renderJobs
                .flatMap((job) => job.outputs)
                .map((output) => (
                  <Badge key={output.id} variant="success">
                    {output.aspectRatio.replace("RATIO_", "").replace("X", ":")} ·{" "}
                    {(output.fileSizeBytes / 1_000_000).toFixed(1)} MB
                  </Badge>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
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
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="text-primary mb-3 size-4" />
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-sm font-medium">{value}</p>
      </CardContent>
    </Card>
  );
}
