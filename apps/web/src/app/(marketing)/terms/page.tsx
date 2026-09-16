import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: 2026-07-31 · Reference build, not legal advice.
      </p>

      <div className="prose prose-invert text-muted-foreground mt-8 max-w-none space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-foreground text-lg font-semibold">No guaranteed outcomes</h2>
          <p>
            ContentForge helps you produce and publish content. We do not guarantee views,
            followers, engagement, leads, or revenue of any kind. Results depend on factors outside
            our control, including platform algorithms and your own offer and market.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">Acceptable use</h2>
          <p>
            You may not use ContentForge to violate any connected platform&apos;s terms of service,
            to publish content that infringes intellectual property, or to circumvent the mandatory
            human-approval workflow via API misuse. We do not provide, and will not add,
            engagement-automation, scraping, or credential-capture features.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">Your content</h2>
          <p>
            You retain ownership of the brand material you upload and the content generated for your
            workspace. You are responsible for reviewing and approving content before it publishes —
            that review step exists by default and cannot be silently bypassed.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">Billing</h2>
          <p>
            This local build demonstrates subscription limits and does not collect payments. Paid
            checkout, cancellation and plan changes require a configured Stripe integration.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">Termination</h2>
          <p>
            Either party may terminate at any time. On termination, your data is retained for the
            grace period described in our Privacy Policy and then permanently deleted.
          </p>
        </section>
      </div>
    </div>
  );
}
