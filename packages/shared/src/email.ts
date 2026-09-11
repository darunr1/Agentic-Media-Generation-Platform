import type { Env } from "./env";

/**
 * EmailProvider — brief §16. One typed interface, two implementations: a
 * console logger (always available, what local dev and the demo run on) and
 * a documented Resend-backed adapter that only activates when
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

/**
 * Documented configuration point for a real provider. Not wired to a live
 * HTTP call here — flip EMAIL_PROVIDER=resend and supply RESEND_API_KEY,
 * then implement the fetch call against https://api.resend.com/emails
 * (Bearer auth, JSON body { from, to, subject, html, text }). Left as a
 * typed stub rather than an unverified live integration: this build
 * environment has no Resend account to test a real send against, per the
 * "never invent successful API responses in production adapters" rule.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly apiKey: string | undefined) {}

  async send(_input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.apiKey) {
      throw new Error(
        "ResendEmailProvider: RESEND_API_KEY is not configured. Setup required — see docs/local-development.md#email.",
      );
    }
    throw new Error(
      "ResendEmailProvider is a documented stub. Implement the POST https://api.resend.com/emails call before using EMAIL_PROVIDER=resend in production.",
    );
  }

  async healthCheck() {
    return {
      healthy: false,
      message: this.apiKey
        ? "Resend adapter is a documented stub and not yet implemented."
        : "RESEND_API_KEY is not configured.",
    };
  }
}

let cachedProvider: EmailProvider | undefined;

/** One place that decides which EmailProvider implementation is active,
 * driven entirely by validated env — used by auth (magic links) and the
 * notification dispatcher alike. */
export function createEmailProviderFromEnv(
  env: Pick<Env, "EMAIL_PROVIDER" | "RESEND_API_KEY">,
): EmailProvider {
  if (cachedProvider) return cachedProvider;
  cachedProvider =
    env.EMAIL_PROVIDER === "resend"
      ? new ResendEmailProvider(env.RESEND_API_KEY)
      : new ConsoleEmailProvider();
  return cachedProvider;
}

/** Test-only escape hatch. */
export function __resetEmailProviderCacheForTests(): void {
  cachedProvider = undefined;
}
