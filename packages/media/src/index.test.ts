import { describe, expect, it, vi } from "vitest";

import {
  detectMediaType,
  sanitizeFilename,
  toSrt,
  toWebVtt,
  LocalObjectStorageProvider,
  verifyStorageSignature,
} from "./index";
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

describe("signed local media", () => {
  it("binds downloads to key, method and expiry", async () => {
    vi.stubEnv("AUTH_SECRET", "unit-test-secret-32-characters-long");
    try {
      const storage = new LocalObjectStorageProvider(".test-media");
      const url = new URL(
        await storage.createSignedDownloadUrl("tenant/video.mp4", 60),
        "http://localhost",
      );
      const key = url.searchParams.get("key")!,
        expires = Number(url.searchParams.get("expires")),
        signature = url.searchParams.get("signature")!;
      expect(verifyStorageSignature(key, expires, signature)).toBe(true);
      expect(verifyStorageSignature("other/video.mp4", expires, signature)).toBe(false);
      expect(verifyStorageSignature(key, expires, signature, "PUT")).toBe(false);
      expect(verifyStorageSignature(key, expires + 1, signature)).toBe(false);
      expect(verifyStorageSignature(key, Date.now() - 1, signature)).toBe(false);
      await expect(storage.get("../../outside")).rejects.toThrow();
      await expect(storage.createSignedUploadUrl("tenant/file", 60)).rejects.toThrow(
        "Setup required",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
