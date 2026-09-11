import { redirect } from "next/navigation";

import { auth } from "@contentforge/auth";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

/**
 * Doubles as first-time onboarding (arriving with zero workspaces) and the
 * "create another workspace" flow (Agency plan, multi-workspace users) — it
 * never redirects an already-onboarded user away, since that would make
 * WorkspaceSwitcher's "New workspace" link unusable. Only the post-sign-in
 * `/app` resolver auto-routes existing users straight to a dashboard.
 */
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return (
    <div className="bg-grid-pattern flex min-h-screen items-center justify-center px-4 py-16">
      <div className="border-border bg-card w-full max-w-md space-y-6 rounded-xl border p-8 shadow-lg">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="text-muted-foreground text-sm">
            A workspace holds one business&apos;s brand, campaigns, and content. You can invite
            teammates and connect social accounts once it&apos;s created.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
