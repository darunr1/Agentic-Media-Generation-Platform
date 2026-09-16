import pino from "pino";

/**
 * Structured JSON logger shared by web/worker/renderer. Redaction list
 * covers every field that has ever held a secret or PII in this codebase —
 * update it whenever a new field could carry one. Log-injection defense:
 * pino serializes to JSON, so untrusted strings (e.g. a webpage-importer
 * title) cannot break out of the log line the way they could with
 * string-concatenated logging.
 */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.accessToken",
  "*.refreshToken",
  "*.encryptedAccessToken",
  "*.encryptedRefreshToken",
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.stripeSecretKey",
  "*.webhookSecret",
  "*.authorization",
];

export interface CreateLoggerOptions {
  name: string;
  level?: string;
}

export function createLogger(options: CreateLoggerOptions) {
  return pino({
    name: options.name,
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    serializers: {
      // SDK/network errors can embed request headers, URLs and secret-bearing bodies.
      err: (error: unknown) => ({
        name: error instanceof Error ? error.name : "Error",
        code:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code.replace(/[^A-Z0-9_]/g, "").slice(0, 40)
            : "UNKNOWN",
      }),
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;

/** Truncates a value for logging so a runaway string (e.g. scraped webpage
 * text) never blows up log storage or a log-shipping pipeline. */
export function truncateForLog(value: string, maxLength = 500): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…[truncated]` : value;
}
