import { describe, expect, it } from "vitest";
import { captionDownloadError, matchingCaptionTrack } from "./caption-download-state";

describe("matchingCaptionTrack", () => {
  const video = "workspace/run-1/video-digest.mp4";
  const vtt = { format: "WEBVTT", storageKey: "workspace/run-1/captions.vtt" };
  const srt = { format: "SRT", storageKey: "workspace/run-1/captions.srt" };

  it("prefers WebVTT and falls back to SRT for the same render", () => {
    expect(matchingCaptionTrack(video, [srt, vtt])).toEqual(vtt);
    expect(matchingCaptionTrack(video, [srt])).toEqual(srt);
  });

  it("rejects captions overwritten by a different workflow", () => {
    const newer = { format: "WEBVTT", storageKey: "workspace/run-2/captions.vtt" };
    expect(matchingCaptionTrack(video, [newer])).toBeUndefined();
    expect(matchingCaptionTrack(video, [newer, srt])).toEqual(srt);
  });

  it("rejects different workspace, prefix collisions, missing or malformed output", () => {
    expect(matchingCaptionTrack("other/run-1/video-digest.mp4", [vtt])).toBeUndefined();
    expect(matchingCaptionTrack("workspace/run-10/video-digest.mp4", [vtt])).toBeUndefined();
    expect(matchingCaptionTrack(undefined, [vtt])).toBeUndefined();
    expect(matchingCaptionTrack("workspace/video.mp4", [vtt])).toBeUndefined();
    expect(matchingCaptionTrack(video, [])).toBeUndefined();
  });
});

describe("captionDownloadError", () => {
  it("gives actionable messages for expired or missing signed media", () => {
    expect(captionDownloadError(403)).toContain("expired");
    expect(captionDownloadError(404)).toContain("unavailable");
    expect(captionDownloadError(500)).toContain("retry");
  });
});
