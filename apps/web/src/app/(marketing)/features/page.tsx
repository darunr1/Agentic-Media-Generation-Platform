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
      "Create and edit products, audience, voice, visual identity, compliance rules and CTAs in a reusable brand profile.",
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
      "Render persisted scene images, on-screen text, captions and reference audio into real 9:16 MP4 files with FFmpeg.",
  },
  {
    icon: FileCheck2,
    title: "Approval built in, not bolted on",
    description:
      "Review playable video and copy, compare saved versions, leave comments and request changes. Publishing requires approval and compliance acknowledgment.",
  },
  {
    icon: Share2,
    title: "Mock publishing and scheduled delivery",
    description:
      "A typed SocialPlatformProvider interface with a fully working mock adapter plus Instagram/YouTube OAuth scaffolding — unsupported platforms are marked, never faked.",
  },
  {
    icon: BarChart3,
    title: "Evidence-based analytics",
    description:
      "Filter stored metrics by date, platform and content. Export CSV and inspect the snapshot evidence supporting each descriptive recommendation.",
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
      "Recorded usage estimates, workspace admission limits and bounded retries help control generation. Missing provider pricing is identified in usage records.",
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
