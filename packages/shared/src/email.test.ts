import { afterEach, describe, expect, it, vi } from "vitest";

import { ResendEmailProvider } from "./email";

const input = {
  to: "person@sequence.test",
  subject: "Sign in",
  text: "https://staging.sequence.test/api/auth/callback/email?token=test",
  html: "<p>Sign in</p>",
};
const sender = "Sequence <login@sequence.test>";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Resend email delivery", () => {
  it("sends the configured sender and recipient and returns the provider ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "email-123" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new ResendEmailProvider("test-key", sender).send(input);
    expect(result).toEqual({ provider: "resend", messageId: "email-123" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer test-key", "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects missing credentials without sending anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new ResendEmailProvider(undefined, sender).send(input)).rejects.toThrow(
      "RESEND_API_KEY",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak provider response bodies or fall back to console", async () => {
    const response = new Response("secret token", { status: 403 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(new ResendEmailProvider("test-key", sender).send(input)).rejects.toThrow(
      /^Resend email request failed \(HTTP 403\)$/,
    );
  });

  it("rejects a malformed success response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await expect(new ResendEmailProvider("test-key", sender).send(input)).rejects.toThrow(
      "invalid email delivery response",
    );
  });
});
