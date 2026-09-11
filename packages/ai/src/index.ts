import { z } from "zod";

export interface ProviderUsageReport {
  provider: string;
  model: string;
  durationMs: number;
  costCents: number;
  inputTokens?: number;
  outputTokens?: number;
  mediaCount?: number;
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "unavailable";
  checkedAt: Date;
  message?: string;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "TIMEOUT" | "RATE_LIMITED" | "INVALID_REQUEST" | "UNAVAILABLE" | "UNKNOWN",
    readonly retryable: boolean,
    readonly provider: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderResult<T> {
  data: T;
  usage: ProviderUsageReport;
  rawResponseId?: string;
}

export interface TextGenerationRequest {
  system: string;
  prompt: string;
  model?: string;
  temperature?: number;
  idempotencyKey: string;
  timeoutMs?: number;
}

export interface TextGenerationProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  generate(request: TextGenerationRequest): Promise<ProviderResult<unknown>>;
  repair(
    request: TextGenerationRequest,
    invalidOutput: unknown,
    issues: string[],
  ): Promise<ProviderResult<unknown>>;
}

export interface EmbeddingProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  embed(
    input: string[],
    options: { idempotencyKey: string; timeoutMs?: number },
  ): Promise<ProviderResult<number[][]>>;
}

export interface BinaryGenerationRequest {
  prompt: string;
  idempotencyKey: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  timeoutMs?: number;
}

export interface GeneratedMedia {
  bytes: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface ImageGenerationProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  generateImage(request: BinaryGenerationRequest): Promise<ProviderResult<GeneratedMedia>>;
}

export interface VideoGenerationProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  generateVideo(request: BinaryGenerationRequest): Promise<ProviderResult<GeneratedMedia>>;
}

export interface TextToSpeechProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  synthesize(input: {
    text: string;
    voice: string;
    idempotencyKey: string;
    timeoutMs?: number;
  }): Promise<ProviderResult<GeneratedMedia>>;
}

export interface TranscriptionProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  transcribe(input: {
    audio: Uint8Array;
    mimeType: string;
    idempotencyKey: string;
    timeoutMs?: number;
  }): Promise<
    ProviderResult<{ text: string; words: Array<{ text: string; startMs: number; endMs: number }> }>
  >;
}

export const brandContextSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().min(1),
  description: z.string().min(1),
  productsServices: z.string().min(1),
  targetCustomers: z.string().min(1),
  geographicMarket: z.string().min(1),
  voice: z.object({
    toneTags: z.array(z.string()),
    personality: z.string(),
    wordsToAvoid: z.array(z.string()),
  }),
  colors: z.object({
    primary: z.string().nullable(),
    secondary: z.string().nullable(),
    accent: z.string().nullable(),
  }),
  guidelines: z.array(z.object({ type: z.string(), content: z.string() })),
  knowledge: z.array(
    z.object({ sourceId: z.string(), title: z.string(), excerpts: z.array(z.string()) }),
  ),
});
export type BrandContext = z.infer<typeof brandContextSchema>;

export const strategySchema = z.object({
  campaignTheme: z.string().min(1),
  audiencePains: z.array(z.string()).min(1),
  audienceDesires: z.array(z.string()).min(1),
  contentPillars: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        percentage: z.number().min(0).max(100),
      }),
    )
    .min(1),
  postingMix: z.array(
    z.object({ platform: z.string(), format: z.string(), count: z.number().int().positive() }),
  ),
  successMetrics: z.array(z.string()),
  complianceConsiderations: z.array(z.string()),
});
export type ContentStrategy = z.infer<typeof strategySchema>;

export const ideaSchema = z.object({
  title: z.string().min(1),
  contentPillar: z.string().min(1),
  targetPlatform: z.string().min(1),
  format: z.enum([
    "SHORT_VIDEO",
    "FEED_SQUARE",
    "FEED_PORTRAIT",
    "LANDSCAPE_VIDEO",
    "TEXT",
    "THREAD",
    "CAROUSEL",
  ]),
  hook: z.string().min(1),
  audienceProblem: z.string().min(1),
  mainTakeaway: z.string().min(1),
  callToAction: z.string().min(1),
  productionDifficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  estimatedDurationSeconds: z.number().int().positive(),
  requiredAssets: z.array(z.string()),
  noveltyExplanation: z.string().min(1),
  complianceNotes: z.array(z.string()),
});
export const ideasSchema = z.array(ideaSchema).length(5);
export type ContentIdeaOutput = z.infer<typeof ideaSchema>;

export const sceneSchema = z
  .object({
    sequenceNumber: z.number().int().positive(),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    narration: z.string(),
    onScreenText: z.string(),
    visualPrompt: z.string(),
    assetType: z.enum(["GENERATED_BACKGROUND", "PHOTO", "VIDEO", "LOGO", "TEXT_ONLY"]),
    transition: z.string(),
    motionInstruction: z.string(),
    audioInstruction: z.string(),
    safeAreaPosition: z.enum(["TOP", "CENTER", "BOTTOM"]),
    sourceAttribution: z.string().nullable(),
  })
  .refine((value) => value.endSeconds > value.startSeconds, {
    message: "Scene must end after it starts",
  });

export const scriptSchema = z.object({
  openingHook: z.string().min(1),
  spokenNarration: z.string().min(1),
  onScreenText: z.array(z.string()),
  sceneDescriptions: z.array(z.string()),
  bRollSuggestions: z.array(z.string()),
  estimatedDurationSeconds: z.number().min(15).max(60),
  callToAction: z.string(),
  caption: z.string(),
  titleAlternatives: z.array(z.string()).min(2),
  hashtags: z.array(z.string()),
  thumbnailText: z.string(),
  platformVariants: z.array(
    z.object({
      platform: z.string(),
      title: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
  scenes: z.array(sceneSchema).min(1),
});
export type ScriptOutput = z.infer<typeof scriptSchema>;

export async function generateStructured<T>(options: {
  provider: TextGenerationProvider;
  request: TextGenerationRequest;
  schema: z.ZodType<T>;
  maxRepairAttempts?: number;
}): Promise<ProviderResult<T>> {
  const maxRepairs = options.maxRepairAttempts ?? 2;
  let result = await options.provider.generate(options.request);
  let usage = { ...result.usage };
  for (let attempt = 0; attempt <= maxRepairs; attempt += 1) {
    const parsed = options.schema.safeParse(result.data);
    if (parsed.success) return { ...result, data: parsed.data, usage };
    if (attempt === maxRepairs)
      throw new ProviderError(
        `Structured output validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
        "INVALID_REQUEST",
        false,
        options.provider.name,
      );
    result = await options.provider.repair(
      options.request,
      result.data,
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
    usage = {
      ...result.usage,
      durationMs: usage.durationMs + result.usage.durationMs,
      costCents: usage.costCents + result.usage.costCents,
      inputTokens: (usage.inputTokens ?? 0) + (result.usage.inputTokens ?? 0),
      outputTokens: (usage.outputTokens ?? 0) + (result.usage.outputTokens ?? 0),
    };
  }
  throw new ProviderError("Unreachable generation state", "UNKNOWN", false, options.provider.name);
}

const mockIdeas: ContentIdeaOutput[] = [
  {
    title: "Three ways to taste coffee like a roaster",
    contentPillar: "Coffee education",
    targetPlatform: "INSTAGRAM",
    format: "SHORT_VIDEO",
    hook: "Your coffee is telling you more than bitter or strong.",
    audienceProblem: "Customers struggle to describe what they enjoy.",
    mainTakeaway: "Aroma, acidity, and finish make tasting approachable.",
    callToAction: "Save this for your next cup.",
    productionDifficulty: "EASY",
    estimatedDurationSeconds: 24,
    requiredAssets: ["coffee cup", "roasting close-up"],
    noveltyExplanation: "Turns tasting jargon into a three-step ritual.",
    complianceNotes: [],
  },
  {
    title: "Myth: dark roast has more caffeine",
    contentPillar: "Coffee education",
    targetPlatform: "TIKTOK",
    format: "SHORT_VIDEO",
    hook: "Darker does not automatically mean stronger.",
    audienceProblem: "Roast level is confused with caffeine strength.",
    mainTakeaway: "Bean measurement and brewing method matter more.",
    callToAction: "Share this with your dark-roast friend.",
    productionDifficulty: "EASY",
    estimatedDurationSeconds: 20,
    requiredAssets: ["light and dark beans"],
    noveltyExplanation: "Uses a quick visual comparison instead of a lecture.",
    complianceNotes: ["Avoid medical or performance claims."],
  },
  {
    title: "Meet the morning flight",
    contentPillar: "Products",
    targetPlatform: "FACEBOOK",
    format: "CAROUSEL",
    hook: "Three small cups. One surprisingly big flavor trip.",
    audienceProblem: "Customers want to explore without buying a full bag.",
    mainTakeaway: "The tasting flight makes discovery low-risk.",
    callToAction: "Book a Saturday tasting.",
    productionDifficulty: "MEDIUM",
    estimatedDurationSeconds: 30,
    requiredAssets: ["three product photos"],
    noveltyExplanation: "Presents products as a guided journey.",
    complianceNotes: [],
  },
  {
    title: "From green bean to Riverbend",
    contentPillar: "Craft",
    targetPlatform: "YOUTUBE",
    format: "LANDSCAPE_VIDEO",
    hook: "This color change decides what ends up in your cup.",
    audienceProblem: "Roasting feels invisible to customers.",
    mainTakeaway: "Careful roast development creates sweetness and balance.",
    callToAction: "Tour the roastery this month.",
    productionDifficulty: "HARD",
    estimatedDurationSeconds: 45,
    requiredAssets: ["roaster footage", "bean macro"],
    noveltyExplanation: "Builds a visual narrative around color change.",
    complianceNotes: [],
  },
  {
    title: "Your two-minute better brew",
    contentPillar: "At-home brewing",
    targetPlatform: "THREADS",
    format: "THREAD",
    hook: "Before buying another brewer, change these two things.",
    audienceProblem: "Home coffee tastes inconsistent.",
    mainTakeaway: "Fresh grinding and measured water improve repeatability.",
    callToAction: "Reply with your brew method.",
    productionDifficulty: "EASY",
    estimatedDurationSeconds: 15,
    requiredAssets: [],
    noveltyExplanation: "Low-cost advice designed for conversation.",
    complianceNotes: [],
  },
];

export class MockTextGenerationProvider implements TextGenerationProvider {
  readonly name = "mock";
  validateConfiguration() {}
  async healthCheck(): Promise<ProviderHealth> {
    return { status: "healthy", checkedAt: new Date(), message: "Deterministic local provider" };
  }
  async generate(request: TextGenerationRequest): Promise<ProviderResult<unknown>> {
    const prompt = request.prompt.toLowerCase();
    const data = prompt.includes("idea")
      ? mockIdeas
      : prompt.includes("script")
        ? this.script()
        : this.strategy();
    return {
      data,
      usage: {
        provider: this.name,
        model: "contentforge-mock-v1",
        durationMs: 8,
        costCents: 0,
        inputTokens: Math.ceil(request.prompt.length / 4),
        outputTokens: 320,
      },
    };
  }
  async repair(request: TextGenerationRequest): Promise<ProviderResult<unknown>> {
    return this.generate(request);
  }
  private strategy(): ContentStrategy {
    return {
      campaignTheme: "Make better coffee feel welcoming",
      audiencePains: ["Inconsistent home coffee", "Intimidating terminology"],
      audienceDesires: ["Reliable morning ritual", "Local connection"],
      contentPillars: [
        {
          name: "Coffee education",
          description: "Practical, friendly brewing knowledge",
          percentage: 50,
        },
        { name: "Craft", description: "People and process behind each roast", percentage: 30 },
        { name: "Products", description: "Offers with useful context", percentage: 20 },
      ],
      postingMix: [
        { platform: "INSTAGRAM", format: "SHORT_VIDEO", count: 8 },
        { platform: "FACEBOOK", format: "CAROUSEL", count: 4 },
      ],
      successMetrics: ["Saves", "Video completion rate", "Tasting bookings"],
      complianceConsiderations: ["Do not make health or performance claims"],
    };
  }
  private script(): ScriptOutput {
    return {
      openingHook: "Your coffee has three clues hiding in every sip.",
      spokenNarration:
        "First, smell before you sip. Next, notice whether the flavor feels bright or round. Finally, pay attention to what lingers. You do not need fancy words—just curiosity. Save this guide for tomorrow morning.",
      onScreenText: ["1 · Aroma", "2 · Bright or round?", "3 · The finish"],
      sceneDescriptions: [
        "Steam rising from a cup",
        "Split-screen tasting comparison",
        "Warm final product shot",
      ],
      bRollSuggestions: ["Coffee bloom", "Roasted beans falling"],
      estimatedDurationSeconds: 24,
      callToAction: "Save this guide for tomorrow morning.",
      caption:
        "Taste coffee with confidence: aroma, acidity, finish. Which clue do you notice first?",
      titleAlternatives: ["Taste coffee in three steps", "A no-jargon tasting guide"],
      hashtags: ["#CoffeeTips", "#LocalCoffee", "#RiverbendRoasters"],
      thumbnailText: "Taste coffee better",
      platformVariants: [
        {
          platform: "INSTAGRAM",
          title: "Taste coffee in 3 steps",
          caption: "Three clues in every cup. Save this for your next brew.",
          hashtags: ["#CoffeeTips", "#LocalCoffee"],
        },
      ],
      scenes: [
        {
          sequenceNumber: 1,
          startSeconds: 0,
          endSeconds: 6,
          narration: "Your coffee has three clues hiding in every sip.",
          onScreenText: "Taste coffee better",
          visualPrompt: "Steam rising from a ceramic cup, deep navy and violet light",
          assetType: "GENERATED_BACKGROUND",
          transition: "fade",
          motionInstruction: "slow push in",
          audioInstruction: "music at -22 LUFS",
          safeAreaPosition: "CENTER",
          sourceAttribution: null,
        },
        {
          sequenceNumber: 2,
          startSeconds: 6,
          endSeconds: 13,
          narration: "First, smell before you sip.",
          onScreenText: "1 · Aroma",
          visualPrompt: "Close-up coffee aroma",
          assetType: "PHOTO",
          transition: "swipe",
          motionInstruction: "pan left",
          audioInstruction: "subtle whoosh",
          safeAreaPosition: "BOTTOM",
          sourceAttribution: null,
        },
        {
          sequenceNumber: 3,
          startSeconds: 13,
          endSeconds: 19,
          narration: "Next, notice whether the flavor feels bright or round.",
          onScreenText: "2 · Bright or round?",
          visualPrompt: "Two coffee cups comparison",
          assetType: "PHOTO",
          transition: "cut",
          motionInstruction: "gentle parallax",
          audioInstruction: "music duck under voice",
          safeAreaPosition: "CENTER",
          sourceAttribution: null,
        },
        {
          sequenceNumber: 4,
          startSeconds: 19,
          endSeconds: 24,
          narration: "Finally, notice what lingers. Save this guide.",
          onScreenText: "3 · The finish",
          visualPrompt: "Branded coffee bag and cup",
          assetType: "LOGO",
          transition: "fade",
          motionInstruction: "logo reveal",
          audioInstruction: "music resolve",
          safeAreaPosition: "CENTER",
          sourceAttribution: null,
        },
      ],
    };
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = "mock";
  validateConfiguration() {}
  async healthCheck(): Promise<ProviderHealth> {
    return { status: "healthy", checkedAt: new Date() };
  }
  async embed(input: string[]): Promise<ProviderResult<number[][]>> {
    return {
      data: input.map((value) =>
        Array.from(
          { length: 16 },
          (_, index) => ((value.charCodeAt(index % Math.max(value.length, 1)) || 0) % 31) / 31,
        ),
      ),
      usage: {
        provider: this.name,
        model: "hash-embedding-v1",
        durationMs: 1,
        costCents: 0,
        inputTokens: input.reduce((sum, value) => sum + Math.ceil(value.length / 4), 0),
      },
    };
  }
}
