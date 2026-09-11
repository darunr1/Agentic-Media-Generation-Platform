import { redirect } from "next/navigation";

import { auth, listUserWorkspaceMemberships } from "@contentforge/auth";

/** Post-sign-in landing resolver: sends the user to their most recent
 * workspace, or into onboarding if they don't have one yet. */
export default async function AppIndexPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const memberships = await listUserWorkspaceMemberships(session.user.id);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  redirect(`/w/${memberships[0]!.workspace.slug}/dashboard`);
}
