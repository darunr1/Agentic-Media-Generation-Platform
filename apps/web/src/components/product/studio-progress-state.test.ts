import { describe, expect, it } from "vitest";
import { studioProgressState } from "./studio-progress-state";

describe("studioProgressState", () => {
  it("shows queued and generating production even when an older video exists", () => {
    expect(studioProgressState("DRAFT", "PENDING", false)).toBe("Generating");
    expect(studioProgressState("VOICE_GENERATION", "RUNNING", true)).toBe("Generating");
  });

  it("shows rendering until production completes", () => {
    expect(studioProgressState("RENDERING", "RUNNING", true)).toBe("Rendering");
    expect(studioProgressState("AWAITING_REVIEW", "SUCCEEDED", true)).toBe("Ready");
  });

  it("does not mistake an earlier output for a successful retry", () => {
    expect(studioProgressState("FAILED", "DEAD_LETTER", true)).toBe("Failed");
    expect(studioProgressState("CANCELLED", "CANCELLED", false)).toBe("Failed");
  });

  it("requires an output before showing ready", () => {
    expect(studioProgressState("DRAFT", undefined, false)).toBe("Not started");
    expect(studioProgressState("AWAITING_REVIEW", "SUCCEEDED", false)).toBe("Not started");
    expect(studioProgressState("PUBLISHED", "SUCCEEDED", true)).toBe("Ready");
  });
});
