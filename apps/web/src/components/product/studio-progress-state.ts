export type StudioProgressState = "Generating" | "Rendering" | "Failed" | "Ready" | "Not started";

const generating = [
  "PLANNING",
  "SCRIPTING",
  "ASSET_GENERATION",
  "VOICE_GENERATION",
  "CAPTION_GENERATION",
];
const active = ["PENDING", "RUNNING", "WAITING"];

export function studioProgressState(
  contentStatus: string,
  runStatus: string | undefined,
  hasVideo: boolean,
): StudioProgressState {
  if (runStatus && ["FAILED", "DEAD_LETTER", "CANCELLED"].includes(runStatus)) return "Failed";
  if (contentStatus === "RENDERING") return "Rendering";
  if (generating.includes(contentStatus) || (runStatus && active.includes(runStatus)))
    return "Generating";
  if (!hasVideo && ["FAILED", "CANCELLED"].includes(contentStatus)) return "Failed";
  return hasVideo ? "Ready" : "Not started";
}
