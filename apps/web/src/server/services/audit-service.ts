import { prisma } from "@contentforge/database";
import type { AuditActorType, Prisma } from "@contentforge/database";

export interface RecordAuditLogInput {
  workspaceId: string;
  actorUserId?: string | null;
  actorType?: AuditActorType;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * Every mutating service call that changes user-visible state should write
 * one of these — it's the data source for the admin audit-log viewer (brief
 * §12) and for reconstructing "what happened" during a support request.
 * Accepts an optional `tx` so callers can include the audit row in the same
 * database transaction as the mutation it's describing.
 */
export async function recordAuditLog(
  input: RecordAuditLogInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? "USER",
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
