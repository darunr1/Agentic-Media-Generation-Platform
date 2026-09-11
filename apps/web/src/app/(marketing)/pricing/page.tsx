import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { PLAN_CATALOG } from "@contentforge/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Simple, usage-aware pricing</h1>
        <p className="text-muted-foreground mt-3">
          Every plan starts with a free trial. No guaranteed results, no hidden usage — your
          plan&apos;s limits are always visible in the dashboard.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PLAN_CATALOG.map((plan, index) => (
          <Card
            key={plan.key}
            className={
              index === 1
                ? "border-primary/60 bg-card shadow-primary/10 relative shadow-lg"
                : "border-border/60 bg-card/60"
            }
          >
            {index === 1 ? (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
            ) : null}
            <CardHeader>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <p className="text-muted-foreground text-sm">{plan.tagline}</p>
              <p className="pt-2">
                <span className="text-3xl font-semibold">
                  ${(plan.monthlyPriceCents / 100).toFixed(0)}
                </span>
                <span className="text-muted-foreground text-sm"> / month</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <Check className="text-success mt-0.5 size-4 shrink-0" />
                    <span className="text-muted-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full" variant={index === 1 ? "default" : "outline"}>
                <Link href="/sign-up">Start free trial</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-xs">
        Prices shown are illustrative defaults for this build and are stored as data, not hard-coded
        — an administrator can adjust them without a deploy. ContentForge does not guarantee
        revenue, followers, or engagement outcomes.
      </p>
    </div>
  );
}
