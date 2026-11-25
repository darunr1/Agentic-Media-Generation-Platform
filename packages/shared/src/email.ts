import type { Env } from "./env";

/**
 * EmailProvider — brief §16. One typed interface, two implementations: a
 * console logger (always available, what local dev and the demo run on) and
 * a Resend-backed adapter that only activates when
 * RESEND_API_KEY is configured. Every notification event and the
 * passwordless-sign-in magic link both go through this interface, so
 * swapping providers never touches call sites.
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Used for provider dashboards / debugging, never shown to the recipient. */
  tag?: string;
}

export interface SendEmailResult {
  provider: string;
  /** Provider-assigned message id when available. */
  messageId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Local/demo default. Logs the full email (including magic links) to the
 * console via the shared structured logger so the passwordless sign-in flow
 * and every notification event are fully exercisable with zero external
 * accounts, per the "no paid service required for the demo" requirement.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  // eslint-disable-next-line no-console -- this class's entire purpose is printing to the console
  constructor(private readonly log: (line: string) => void = console.info) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.log(
      [
        "\n────────── ContentForge console email ──────────",
        `To:      ${input.to}`,
        `Subject: ${input.subject}`,
        `Tag:     ${input.tag ?? "(none)"}`,
        "--------------------------------------------------",
        input.text,
        "──────────────────────────────────────────────────\n",
      ].join("\n"),
    );
    return { provider: this.name };
  }

  async healthCheck() {
    return { healthy: true };
  }
}

/** Resend-backed delivery. Never log API keys, response bodies or magic links. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string | undefined,
    private readonly from?: string,
  ) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.apiKey?.trim() || !this.from?.trim()) {
      throw new Error("Resend email requires RESEND_API_KEY and EMAIL_FROM");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {
      throw new Error("Resend email request failed");
    });
    if (!response.ok) {
      throw new Error(`Resend email request failed (HTTP ${response.status})`);
    }

    const result: unknown = await response.json().catch(() => null);
    if (
      !result ||
      typeof result !== "object" ||
      !("id" in result) ||
      typeof result.id !== "string" ||
      !result.id
    ) {
      throw new Error("Resend returned an invalid email delivery response");
    }
    return { provider: this.name, messageId: result.id };
  }

  async healthCheck() {
    return {
      healthy: Boolean(this.apiKey?.trim() && this.from?.trim()),
      message: "Configuration only; real email delivery requires a live smoke test.",
    };
  }
}

let cachedProvider: EmailProvider | undefined;

/** One place that decides which EmailProvider implementation is active,
 * driven entirely by validated env — used by auth (magic links) and the
 * notification dispatcher alike. */
export function createEmailProviderFromEnv(
  env: Pick<Env, "EMAIL_PROVIDER" | "RESEND_API_KEY" | "EMAIL_FROM">,
): EmailProvider {
  if (cachedProvider) return cachedProvider;
  cachedProvider =
    env.EMAIL_PROVIDER === "resend"
      ? new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new ConsoleEmailProvider();
  return cachedProvider;
}

/** Test-only escape hatch. */
export function __resetEmailProviderCacheForTests(): void {
  cachedProvider = undefined;
}
