import { describe, expect, it } from "vitest";

import { detectMediaType, sanitizeFilename, toSrt, toWebVtt } from "./index";
describe("media safety", () => {
  it("checks magic bytes", () =>
    expect(detectMediaType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png"));
  it("sanitizes untrusted filenames", () =>
    expect(sanitizeFilename("../../my file<script>.png")).toBe("..-..-my-file-script-.png"));
  it("creates both caption formats", () => {
    const cue = [{ startSeconds: 0, endSeconds: 1.25, text: "Hello <world>" }];
    expect(toSrt(cue)).toContain("00:00:01,250");
    expect(toWebVtt(cue)).toContain("WEBVTT");
    expect(toSrt(cue)).not.toContain("<world>");
  });
});
