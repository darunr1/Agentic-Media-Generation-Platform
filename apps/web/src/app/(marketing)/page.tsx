import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clapperboard,
  LineChart,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";

const STEPS = [
  {
    icon: Wand2,
    title: "Tell us about your business",
    description:
      "Products, audience, brand voice, colors, offers, and the words you never want used. One structured brand profile, reused everywhere.",
  },
  {
    icon: Sparkles,
    title: "Get a real content plan",
    description:
      "A monthly strategy, content pillars, and ready-to-shoot ideas with hooks, scripts, and scene-by-scene production plans.",
  },
  {
    icon: Clapperboard,
    title: "Render real video, locally",
    description:
      "Turn scene images, captions and reference audio into playable 9:16 MP4 videos with FFmpeg. Natural speech and additional production formats require further setup.",
  },
  {
    icon: ClipboardCheck,
    title: "Review before anything goes out",
    description:
      "Review the rendered video and copy, request changes, and acknowledge compliance before approving content for scheduling.",
  },
  {
    icon: Calendar,
    title: "Schedule and publish",
    description:
      "Schedule approved content for the working mock destination. Real social publishing requires platform approval and an implemented adapter.",
  },
  {
    icon: LineChart,
    title: "Learn from what actually happens",
    description:
      "Inspect stored mock analytics and recommendations linked to their source snapshots. Real audience metrics require a connected platform adapter.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="bg-grid-pattern relative overflow-hidden">
        <div className="bg-glow absolute inset-0" style={{ ["--y" as string]: "-10%" }} />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Badge variant="outline" className="mx-auto mb-6 w-fit">
            <ShieldCheck className="size-3.5" /> Human approval on every publish, by default
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            AI content production for small businesses,{" "}
            <span className="from-primary to-accent bg-gradient-to-r bg-clip-text text-transparent">
              built to actually ship
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-balance text-lg">
            ContentForge turns your brand profile into a monthly content strategy, real rendered
            video, and scheduled posts — with a review queue standing between every draft and your
            audience.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">Start your free trial</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/features">See how it works</Link>
            </Button>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            No credit card required. Revenue is never guaranteed — we help you produce and publish,
            the results are yours to earn.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            From brand profile to published post
          </h2>
          <p className="text-muted-foreground mt-3">
            One deterministic, auditable pipeline — not an unsupervised agent making calls on your
            behalf.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.title} className="border-border/60 bg-card/60">
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg">
                  <step.icon className="size-5" />
                </div>
                <CardTitle>{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {step.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-border/60 bg-secondary/10 border-t">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">What we will never build</h2>
          <p className="text-muted-foreground mt-3">
            No fake engagement, no follower bots, no account farming, no scraping, no CAPTCHA
            bypassing, no credential capture. Only official platform APIs and OAuth.
          </p>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-left text-sm sm:grid-cols-2">
            {[
              "Automated likes, comments, or followers",
              "Platform scraping or browser automation logins",
              "Guaranteed-revenue claims",
              "Publishing without human approval by default",
            ].map((item) => (
              <li key={item} className="text-muted-foreground flex items-start gap-2">
                <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
