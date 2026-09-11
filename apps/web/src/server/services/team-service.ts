import { prisma } from "@contentforge/database";
import type { WorkspaceRole } from "@contentforge/database";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createEmailProviderFromEnv,
  generateOpaqueToken,
  hashToken,
  loadEnv,
} from "@contentforge/shared";

import { recordAuditLog } from "./audit-service";

const INVITATION_TTL_DAYS = 7;

export async function listMembers(workspaceId: string) {
  return prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listPendingInvitations(workspaceId: string) {
  return prisma.invitation.findMany({
    where: { workspaceId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export interface InviteMemberInput {
  workspaceId: string;
  workspaceName: string;
  invitedByUserId: string;
  email: string;
  role: WorkspaceRole;
}

export async function inviteMember(input: InviteMemberInput) {
  const email = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: existingUser.id,
        },
      },
    });
    if (existingMembership) {
      throw new ConflictError("This person is already a member of the workspace");
    }
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: { workspaceId: input.workspaceId, email, status: "PENDING" },
  });
  if (existingInvitation) {
    throw new ConflictError("An invitation is already pending for this email");
  }

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.invitation.create({
      data: {
        workspaceId: input.workspaceId,
        email,
        role: input.role,
        tokenHash,
        invitedByUserId: input.invitedByUserId,
        expiresAt,
      },
    });
    await recordAuditLog(
      {
        workspaceId: input.workspaceId,
        actorUserId: input.invitedByUserId,
        action: "invitation.created",
        targetType: "Invitation",
        targetId: created.id,
        metadata: { email, role: input.role },
      },
      tx,
    );
    return created;
  });

  const env = loadEnv();
  const emailProvider = createEmailProviderFromEnv(env);
  const acceptUrl = `${env.APP_URL}/invitations/${token}`;
  await emailProvider.send({
    to: email,
    subject: `You've been invited to ${input.workspaceName} on ContentForge`,
    text: `You've been invited to join ${input.workspaceName} on ContentForge as ${input.role}.\n\nAccept the invitation: ${acceptUrl}\n\nThis link expires in ${INVITATION_TTL_DAYS} days.`,
    html: `<p>You've been invited to join <strong>${input.workspaceName}</strong> on ContentForge as <strong>${input.role}</strong>.</p><p><a href="${acceptUrl}">Accept the invitation</a></p><p>This link expires in ${INVITATION_TTL_DAYS} days.</p>`,
    tag: "team-invitation",
  });

  return invitation;
}

export async function revokeInvitation(
  workspaceId: string,
  invitationId: string,
  actorUserId: string,
) {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, workspaceId },
  });
  if (!invitation) throw new NotFoundError("Invitation", invitationId);

  await prisma.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });
    await recordAuditLog(
      {
        workspaceId,
        actorUserId,
        action: "invitation.revoked",
        targetType: "Invitation",
        targetId: invitationId,
      },
      tx,
    );
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const tokenHash = hashToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
  });
  if (!invitation || invitation.status !== "PENDING") {
    throw new NotFoundError("Invitation");
  }
  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    throw new ValidationError(
      "This invitation has expired. Ask a workspace admin to send a new one.",
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new ValidationError("This invitation was sent to a different email address");
  }

  const workspace = await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.upsert({
      where: {
        workspaceId_userId: { workspaceId: invitation.workspaceId, userId },
      },
      update: {},
      create: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    await recordAuditLog(
      {
        workspaceId: invitation.workspaceId,
        actorUserId: userId,
        action: "invitation.accepted",
        targetType: "Invitation",
        targetId: invitation.id,
      },
      tx,
    );
    return tx.workspace.findUniqueOrThrow({
      where: { id: invitation.workspaceId },
    });
  });

  return workspace;
}

export async function removeMember(workspaceId: string, membershipId: string, actorUserId: string) {
  const membership = await prisma.workspaceMembership.findFirst({
    where: { id: membershipId, workspaceId },
  });
  if (!membership) throw new NotFoundError("Membership", membershipId);
  if (membership.role === "OWNER") {
    throw new ValidationError("The workspace owner cannot be removed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.delete({ where: { id: membershipId } });
    await recordAuditLog(
      {
        workspaceId,
        actorUserId,
        action: "membership.removed",
        targetType: "WorkspaceMembership",
        targetId: membershipId,
        metadata: { removedUserId: membership.userId },
      },
      tx,
    );
  });
}
