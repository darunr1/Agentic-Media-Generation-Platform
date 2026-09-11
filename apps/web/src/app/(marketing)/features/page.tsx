import type { Metadata } from "next";
import {
  BarChart3,
  Bot,
  Calendar,
  Clapperboard,
  FileCheck2,
  Layers,
  Share2,
  ShieldCheck,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";

export const metadata: Metadata = { title: "Features" };

const FEATURES = [
  {
    icon: Bot,
    title: "Structured brand knowledge",
    description:
      "A 10-section onboarding wizard captures products, audience, voice, visual identity, compliance rules, and CTAs into one BrandContext every generation step reads from.",
  },
  {
    icon: Layers,
    title: "Campaign & idea planning",
    description:
      "Monthly strategy generation with content pillars, audience pains/desires, and a recommended posting mix — then five-idea batches with hooks, formats, and compliance notes.",
  },
  {
    icon: Clapperboard,
    title: "Scripts, scenes & real rendering",
    description:
      "Typed scripts and scene-by-scene production plans render into real MP4s via FFmpeg/Remotion — 9:16, 1:1, 4:5, and 16:9, with burned-in captions and brand styling.",
  },
  {
    icon: FileCheck2,
    title: "Approval built in, not bolted on",
    description:
      "A mandatory review queue with scene-level comments, regenerate-one-scene, version history, and expiring client approval links — publishing is blocked without it.",
  },
  {
    icon: Share2,
    title: "Official-API publishing only",
    description:
      "A typed SocialPlatformProvider interface with a fully working mock adapter plus Instagram/YouTube OAuth scaffolding — unsupported platforms are marked, never faked.",
  },
  {
    icon: BarChart3,
    title: "Evidence-based analytics",
    description:
      "Normalized metrics by platform, pillar, hook, and format, with recommendations explicitly labeled as hypotheses when the sample size is too small to trust.",
  },
  {
    icon: Calendar,
    title: "Content calendar & scheduling",
    description:
      "See every draft, scheduled, and published item in one calendar, with duplicate-publish protection enforced at the database level.",
  },
  {
    icon: ShieldCheck,
    title: "Cost & usage guardrails",
    description:
      "Per-workspace spending caps, per-job generation limits, and full provider cost tracking so AI spend never runs away unnoticed.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Everything between an idea and a published post
        </h1>
        <p className="text-muted-foreground mt-3">
          Every step is a persisted, resumable workflow — not an opaque agent. You can see exactly
          what ran, what it cost, and retry anything that failed.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="border-border/60 bg-card/60">
            <CardHeader>
              <div className="bg-accent/10 text-accent mb-2 flex size-10 items-center justify-center rounded-lg">
                <feature.icon className="size-5" />
              </div>
              <CardTitle>{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
