import { evaluateBrandRules } from "../../agents/content-agents";
import type { BrandContext } from "../../schemas/content";
import type { ContentIdeaOutput, ContentStrategy, ScriptOutput } from "../../schemas/content";
import type {
  TextGenerationProvider,
  ProviderHealth,
  TextGenerationRequest,
  ProviderResult,
  EmbeddingProvider,
} from "../types";
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
    const operation =
      request.operation ??
      (prompt.includes("idea") ? "ideas" : prompt.includes("script") ? "script" : "strategy");
    const input = (() => {
      try {
        return JSON.parse(request.prompt) as {
          brand?: BrandContext;
          idea?: ContentIdeaOutput;
          script?: ScriptOutput;
          expectedCta?: string;
          platforms?: string[];
          objective?: string;
        };
      } catch {
        return {};
      }
    })();
    let data: unknown;
    if (operation === "critique" && input.script && input.brand) {
      data = evaluateBrandRules(input.script, input.brand, input.expectedCta);
    } else if (operation === "revision" && input.script) {
      let revised = JSON.stringify(input.script);
      for (const word of input.brand?.voice.wordsToAvoid ?? [])
        if (word.trim()) revised = revised.split(word).join("thoughtful");
      const script = JSON.parse(revised) as ScriptOutput;
      script.callToAction = input.expectedCta ?? script.callToAction;
      for (const guideline of input.brand?.guidelines ?? []) {
        if (guideline.type !== "REQUIRED_DISCLAIMER") continue;
        if (!script.caption.toLowerCase().includes(guideline.content.toLowerCase()))
          script.caption += ` ${guideline.content}`;
        for (const variant of script.platformVariants)
          if (!variant.caption.toLowerCase().includes(guideline.content.toLowerCase()))
            variant.caption += ` ${guideline.content}`;
      }
      data = script;
    } else if (operation === "ideas") {
      data = mockIdeas.map((idea, i) => ({
        ...idea,
        targetPlatform: input.platforms?.[i % input.platforms.length] ?? idea.targetPlatform,
        ...(input.brand && !input.brand.industry.toLowerCase().includes("coffee")
          ? {
              title: `${input.brand.name}: ${["three useful tips", "a common misconception", "meet the product", "behind the scenes", "a practical guide"][i]}`,
              hook: `Discover ${input.brand.productsServices.slice(0, 100)}`,
              mainTakeaway: input.brand.description.slice(0, 300),
            }
          : {}),
      }));
    } else if (operation === "script") {
      const script = this.script();
      if (input.idea) {
        script.openingHook = input.idea.hook;
        script.callToAction = input.idea.callToAction;
        const beats = [
          input.idea.hook,
          input.idea.audienceProblem,
          input.idea.mainTakeaway,
          input.idea.callToAction,
        ];
        script.spokenNarration = beats.join(" ");
        script.caption = `${input.idea.mainTakeaway} ${input.idea.callToAction}`;
        script.scenes = script.scenes.map((scene, i) => ({
          ...scene,
          narration: beats[i] ?? "",
          onScreenText: i === 0 ? input.idea!.title : (beats[i] ?? ""),
          visualPrompt: `${input.brand?.name ?? "Brand"}: ${input.idea!.requiredAssets[i % Math.max(1, input.idea!.requiredAssets.length)] ?? input.idea!.title}`,
        }));
        script.platformVariants = [
          {
            platform: input.idea.targetPlatform,
            title: input.idea.title,
            caption: script.caption,
            hashtags: script.hashtags,
          },
        ];
      }
      data = script;
    } else {
      const strategy = this.strategy();
      if (input.objective) strategy.campaignTheme = input.objective;
      if (input.brand) {
        strategy.audienceDesires = [input.brand.targetCustomers];
        strategy.complianceConsiderations = input.brand.guidelines.map((g) => g.content);
      }
      if (input.platforms)
        strategy.postingMix = input.platforms.map((platform) => ({
          platform,
          format: "SHORT_VIDEO",
          count: 4,
        }));
      data = strategy;
    }
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
