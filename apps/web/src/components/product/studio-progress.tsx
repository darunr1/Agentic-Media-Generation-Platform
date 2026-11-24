"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@contentforge/ui";
import type { StudioProgressState } from "./studio-progress-state";

const descriptions: Record<StudioProgressState, string> = {
  Generating: "Preparing the script, scene assets, audio or captions.",
  Rendering: "Assembling the video. This may take a few minutes.",
  Failed: "Video production did not complete. Check the workflow for details.",
  Ready: "The rendered video is ready to preview.",
  "Not started": "Start generation to create a video.",
};

export function StudioProgress({
  state,
  hasVideo,
  workflowHref,
}: {
  state: StudioProgressState;
  hasVideo: boolean;
  workflowHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const processing = state === "Generating" || state === "Rendering";

  useEffect(() => {
    if (!processing || pending) return;
    // Re-read the authoritative server state, including the preview when rendering finishes.
    const timer = setInterval(() => {
      if (!document.hidden) startTransition(() => router.refresh());
    }, 3000);
    return () => clearInterval(timer);
  }, [processing, pending, router]);

  return (
    <section aria-label="Video progress" className="space-y-2 rounded-xl border p-4">
      <div role="status" aria-live="polite" className="space-y-2">
        <Badge variant={state === "Ready" ? "success" : "outline"}>{state}</Badge>
        <p className="text-sm">{descriptions[state]}</p>
        {hasVideo && state !== "Ready" && (
          <p className="text-muted-foreground text-sm">
            The preview is from a previous successful render.
          </p>
        )}
      </div>
      {processing && (
        <p className="text-muted-foreground text-xs">
          Updates automatically while this tab is open.
        </p>
      )}
      {workflowHref && (
        <a href={workflowHref} className="text-primary text-sm underline">
          View production workflow
        </a>
      )}
    </section>
  );
}
