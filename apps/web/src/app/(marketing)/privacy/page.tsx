import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: 2026-07-31 · Reference build, not legal advice.
      </p>

      <div className="prose prose-invert text-muted-foreground mt-8 max-w-none space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-foreground text-lg font-semibold">What we collect</h2>
          <p>
            Account information (name, email), workspace and brand data you provide during
            onboarding, uploaded media assets, connected social account metadata (never raw OAuth
            tokens — those are encrypted at rest and never returned by any API response), and
            product usage data needed to enforce plan limits and report costs back to you.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">How we use it</h2>
          <p>
            Solely to operate the product: generating and rendering your content, publishing it to
            platforms you explicitly connect, computing analytics, and enforcing the usage limits of
            your plan. We do not sell personal data.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">Third-party processors</h2>
          <p>
            Depending on which providers your workspace is configured to use, data may be sent to AI
            generation providers, payment processing (Stripe), and connected social platforms&apos;
            official APIs. Local/mock providers process everything on your own infrastructure and
            send nothing to a third party.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">Data deletion</h2>
          <p>
            Workspace owners can request deletion of a workspace or an individual account from
            Settings. Deletion soft-deletes user-visible records immediately and permanently removes
            data — including stored media — after a grace period, per the account-deletion workflow
            described in SECURITY.md.
          </p>
        </section>
        <section>
          <h2 className="text-foreground text-lg font-semibold">Contact</h2>
          <p>
            This is a reference implementation; replace this section with your organization&apos;s
            real contact details before operating this as a live service.
          </p>
        </section>
      </div>
    </div>
  );
}
