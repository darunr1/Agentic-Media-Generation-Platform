import { z } from "zod";
export const brandContextSchema = z.object({
  brandId: z.string().max(10000).min(1),
  name: z.string().max(10000).min(1),
  industry: z.string().max(10000).min(1),
  description: z.string().max(10000).min(1),
  productsServices: z.string().max(10000).min(1),
  targetCustomers: z.string().max(10000).min(1),
  geographicMarket: z.string().max(10000).min(1),
  voice: z.object({
    toneTags: z.array(z.string().max(10000)),
    personality: z.string().max(10000),
    wordsToAvoid: z.array(z.string().max(10000)),
  }),
  colors: z.object({
    primary: z.string().max(10000).nullable(),
    secondary: z.string().max(10000).nullable(),
    accent: z.string().max(10000).nullable(),
  }),
  guidelines: z.array(z.object({ type: z.string().max(10000), content: z.string().max(10000) })),
  knowledge: z.array(
    z.object({
      sourceId: z.string().max(10000),
      title: z.string().max(10000),
      excerpts: z.array(z.string().max(10000)),
    }),
  ),
});
export type BrandContext = z.infer<typeof brandContextSchema>;

export const strategySchema = z.object({
  campaignTheme: z.string().max(10000).min(1),
  audiencePains: z.array(z.string().max(10000)).min(1),
  audienceDesires: z.array(z.string().max(10000)).min(1),
  contentPillars: z
    .array(
      z.object({
        name: z.string().max(10000),
        description: z.string().max(10000),
        percentage: z.number().min(0).max(100),
      }),
    )
    .min(1),
  postingMix: z.array(
    z.object({
      platform: z.string().max(10000),
      format: z.string().max(10000),
      count: z.number().int().positive(),
    }),
  ),
  successMetrics: z.array(z.string().max(10000)),
  complianceConsiderations: z.array(z.string().max(10000)),
});
export type ContentStrategy = z.infer<typeof strategySchema>;

export const ideaSchema = z.object({
  title: z.string().max(10000).min(1),
  contentPillar: z.string().max(10000).min(1),
  targetPlatform: z.string().max(10000).min(1),
  format: z.enum([
    "SHORT_VIDEO",
    "FEED_SQUARE",
    "FEED_PORTRAIT",
    "LANDSCAPE_VIDEO",
    "TEXT",
    "THREAD",
    "CAROUSEL",
  ]),
  hook: z.string().max(10000).min(1),
  audienceProblem: z.string().max(10000).min(1),
  mainTakeaway: z.string().max(10000).min(1),
  callToAction: z.string().max(10000).min(1),
  productionDifficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  estimatedDurationSeconds: z.number().int().positive(),
  requiredAssets: z.array(z.string().max(10000)),
  noveltyExplanation: z.string().max(10000).min(1),
  complianceNotes: z.array(z.string().max(10000)),
});
export const ideasSchema = z.array(ideaSchema).length(5);
export type ContentIdeaOutput = z.infer<typeof ideaSchema>;

export const sceneSchema = z
  .object({
    sequenceNumber: z.number().int().positive(),
    startSeconds: z.number().nonnegative().max(60),
    endSeconds: z.number().positive().max(60),
    narration: z.string().max(10000),
    onScreenText: z.string().max(10000),
    visualPrompt: z.string().max(10000),
    assetType: z.enum(["GENERATED_BACKGROUND", "PHOTO", "VIDEO", "LOGO", "TEXT_ONLY"]),
    transition: z.string().max(10000),
    motionInstruction: z.string().max(10000),
    audioInstruction: z.string().max(10000),
    safeAreaPosition: z.enum(["TOP", "CENTER", "BOTTOM"]),
    sourceAttribution: z.string().max(10000).nullable(),
  })
  .refine((value) => value.endSeconds > value.startSeconds, {
    message: "Scene must end after it starts",
  });

export const scriptSchema = z.object({
  openingHook: z.string().max(10000).min(1),
  spokenNarration: z.string().max(10000).min(1),
  onScreenText: z.array(z.string().max(10000)),
  sceneDescriptions: z.array(z.string().max(10000)),
  bRollSuggestions: z.array(z.string().max(10000)),
  estimatedDurationSeconds: z.number().min(15).max(60),
  callToAction: z.string().max(10000),
  caption: z.string().max(10000),
  titleAlternatives: z.array(z.string().max(10000)).min(2),
  hashtags: z.array(z.string().max(10000)),
  thumbnailText: z.string().max(10000),
  platformVariants: z.array(
    z.object({
      platform: z.string().max(10000),
      title: z.string().max(10000),
      caption: z.string().max(10000),
      hashtags: z.array(z.string().max(10000)),
    }),
  ),
  scenes: z.array(sceneSchema).min(1).max(20),
});
export type ScriptOutput = z.infer<typeof scriptSchema>;
