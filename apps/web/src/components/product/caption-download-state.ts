interface Track {
  format: string;
  storageKey: string;
}

export function matchingCaptionTrack<T extends Track>(
  videoKey: string | undefined,
  tracks: readonly T[],
): T | undefined {
  // Both outputs are stored under workspaceId/workflowRunId by the production worker.
  // CaptionTrack rows are reused across runs, so scriptId or generationJobId is not enough.
  const prefix = videoKey?.match(/^([^/]+\/[^/]+)\/video-[^/]+\.mp4$/)?.[1];
  if (!prefix) return undefined;
  return (
    tracks.find((t) => t.format === "WEBVTT" && t.storageKey === `${prefix}/captions.vtt`) ??
    tracks.find((t) => t.format === "SRT" && t.storageKey === `${prefix}/captions.srt`)
  );
}

export function captionDownloadError(status: number): string {
  if (status === 403) return "The caption link expired or is invalid. Refresh the link and retry.";
  if (status === 404) return "The caption file is unavailable. Refresh the link and retry.";
  return "Could not download captions. Please retry.";
}
