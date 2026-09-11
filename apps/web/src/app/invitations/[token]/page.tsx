import { redirect } from "next/navigation";

import { auth } from "@contentforge/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { acceptInvitation } from "@/server/services/team-service";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  let workspaceSlug: string;
  try {
    const workspace = await acceptInvitation(token, session.user.id);
    workspaceSlug = workspace.slug;
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? String(error.message) : undefined;
    if (!message) throw error;
    return (
      <AuthCard title="Invitation problem" description={message}>
        <p className="text-muted-foreground text-center text-sm">
          Ask whoever invited you to send a new invitation.
        </p>
      </AuthCard>
    );
  }

  redirect(`/w/${workspaceSlug}/team`);
}
