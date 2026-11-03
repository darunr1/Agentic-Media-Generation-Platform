import { z } from "zod";

/** D03: the selector exists, but the production voice worker remains mock-only until D04. */
export const OPENAI_TTS_NOT_WIRED_MESSAGE =
  "AI_TTS_PROVIDER=openai is not supported by the production pipeline yet: real OpenAI TTS is not wired into generation.voice; use AI_TTS_PROVIDER=mock until D04.";

/**
 * Every environment variable the platform reads, in one place, validated at
 * process startup (imported at the top of each app's entrypoint). Failing
 * fast here is the "secret validation at startup" requirement — a
 * misconfigured deploy should never boot far enough to serve traffic.
 */
const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(3000),

  // --- Database -----------------------------------------------------------
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // --- Auth -----------------------------------------------------------------
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_TRUST_HOST: z.coerce.boolean().default(true),

  // --- Encryption (OAuth token / secret-at-rest encryption) ---------------
  // 32-byte key, base64-encoded (44 chars). Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ENCRYPTION_KEY: z
    .string()
    .min(1, "ENCRYPTION_KEY is required")
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    }),

  // --- Storage --------------------------------------------------------------
  STORAGE_PROVIDER: z.enum(["local", "gcs"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default(".local-storage"),
  GCS_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),

  // --- Task queue -------------------------------------------------------------
  QUEUE_PROVIDER: z.enum(["postgres", "local", "cloud-tasks"]).default("postgres"),
  CLOUD_TASKS_PROJECT_ID: z.string().optional(),
  CLOUD_TASKS_LOCATION: z.string().optional(),
  CLOUD_TASKS_QUEUE: z.string().optional(),
  CLOUD_TASKS_WORKER_URL: z.string().url().optional(),

  // --- AI providers -----------------------------------------------------------
  AI_TEXT_PROVIDER: z.enum(["mock", "openai", "gemini"]).default("mock"),
  AI_IMAGE_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  AI_VIDEO_PROVIDER: z.enum(["mock"]).default("mock"),
  AI_TTS_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  AI_TRANSCRIPTION_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  AI_FALLBACK_PROVIDER: z.enum(["openai", "gemini"]).optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(45000),
  OPENAI_TEXT_MODEL: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().optional(),
  OPENAI_TTS_MODEL: z.string().optional(),
  OPENAI_TTS_VOICE: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().optional(),
  OPENAI_INPUT_CENTS_PER_MILLION: z.coerce.number().nonnegative().optional(),
  OPENAI_OUTPUT_CENTS_PER_MILLION: z.coerce.number().nonnegative().optional(),
  GEMINI_INPUT_CENTS_PER_MILLION: z.coerce.number().nonnegative().optional(),
  GEMINI_OUTPUT_CENTS_PER_MILLION: z.coerce.number().nonnegative().optional(),
  OPENAI_IMAGE_COST_CENTS: z.coerce.number().nonnegative().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),

  // --- Workspace spending guardrails -----------------------------------------
  DEFAULT_WORKSPACE_MONTHLY_BUDGET_CENTS: z.coerce.number().int().nonnegative().default(2000),
  DEFAULT_WORKSPACE_BUDGET_WARNING_PCT: z.coerce.number().min(0).max(1).default(0.8),
  MAX_GENERATION_JOBS_PER_CONTENT_ITEM: z.coerce.number().int().positive().default(10),

  // --- Email ------------------------------------------------------------------
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("ContentForge <notifications@contentforge.local>"),

  // --- Social -------------------------------------------------------------------
  SOCIAL_MOCK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),

  // --- Billing ------------------------------------------------------------------
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_GROWTH: z.string().optional(),
  STRIPE_PRICE_AGENCY: z.string().optional(),

  // --- Rendering ------------------------------------------------------------------
  RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  FFMPEG_PATH: z.string().optional(),

  // --- Observability -----------------------------------------------------------
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const envSchema = baseEnvSchema.superRefine((config, ctx) => {
  if (config.AI_TTS_PROVIDER !== "openai") return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["AI_TTS_PROVIDER"],
    message: OPENAI_TTS_NOT_WIRED_MESSAGE,
  });
  for (const key of ["OPENAI_API_KEY", "OPENAI_TTS_MODEL", "OPENAI_TTS_VOICE"] as const) {
    if (!config[key]?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when AI_TTS_PROVIDER=openai`,
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parses and validates `process.env`. Throws a single, readable error
 * listing every problem at once rather than failing on the first field, so a
 * misconfigured deploy tells you everything wrong in one log line.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. See .env.example for the full list.\n${issues}`,
    );
  }
  cached = result.data;
  return cached;
}

/** Test-only escape hatch so unit tests can reset the memoized env between cases. */
export function __resetEnvCacheForTests(): void {
  cached = undefined;
}
