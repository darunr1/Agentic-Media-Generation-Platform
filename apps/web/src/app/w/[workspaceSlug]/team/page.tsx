import { notFound } from "next/navigation";
import { Mail } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@contentforge/ui";
import { hasPermission } from "@contentforge/auth";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { MemberRowActions } from "@/components/team/member-row-actions";
import { RevokeInvitationButton } from "@/components/team/revoke-invitation-button";
import { getWorkspaceContext } from "@/server/services/workspace-context";
import { listMembers, listPendingInvitations } from "@/server/services/team-service";

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function TeamPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const [members, invitations] = await Promise.all([
    listMembers(ctx.workspace.id),
    hasPermission(ctx.role, "team:manage")
      ? listPendingInvitations(ctx.workspace.id)
      : Promise.resolve([]),
  ]);

  const canManage = hasPermission(ctx.role, "team:manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm">Who has access to {ctx.workspace.name}.</p>
        </div>
        {canManage ? <InviteMemberDialog workspaceSlug={workspaceSlug} /> : null}
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-border/60 divide-y p-0">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{initials(member.user.name, member.user.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.user.name ?? member.user.email}</p>
                  <p className="text-muted-foreground text-xs">{member.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{member.role}</Badge>
                {canManage && member.role !== "OWNER" ? (
                  <MemberRowActions workspaceSlug={workspaceSlug} membershipId={member.id} />
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {canManage ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invitations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Mail}
                  title="No pending invitations"
                  description="Invite a teammate to get started."
                />
              </div>
            ) : (
              <div className="divide-border/60 divide-y">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{invitation.email}</p>
                      <p className="text-muted-foreground text-xs">
                        Invited as {invitation.role} · expires{" "}
                        {invitation.expiresAt.toLocaleDateString()}
                      </p>
                    </div>
                    <RevokeInvitationButton
                      workspaceSlug={workspaceSlug}
                      invitationId={invitation.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
