// @vitest-environment node
import { describe, expect, it } from "vitest";
import { importPublicWebpage } from "./web-import-service";
describe("import boundaries", () => {
  it.each([
    "http://127.0.0.1",
    "http://169.254.169.254",
    "http://10.1.2.3",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[fe80::1]",
    "http://192.0.2.1",
    "http://198.18.0.1",
    "file:///etc/passwd",
    "http://example.com:8080",
    "https://user:pass@example.com",
  ])("rejects %s before opening a connection", async (url) => {
    await expect(importPublicWebpage(url)).rejects.toThrow();
  });
});
