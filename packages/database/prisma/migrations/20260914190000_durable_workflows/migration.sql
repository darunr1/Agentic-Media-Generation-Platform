-- CreateEnum
CREATE TYPE "QueuedTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRYING', 'COMPLETED', 'DEAD_LETTER', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowStepStatus" ADD VALUE 'RETRYING';
ALTER TYPE "WorkflowStepStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "model" TEXT,
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "workflowRunId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkflowStep" ADD COLUMN     "agentName" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "validation" JSONB;

-- CreateTable
CREATE TABLE "QueuedTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "QueuedTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "reservationToken" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueuedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueuedTask_status_scheduledAt_idx" ON "QueuedTask"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "QueuedTask_status_leaseExpiresAt_idx" ON "QueuedTask"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "QueuedTask_workflowRunId_idx" ON "QueuedTask"("workflowRunId");

-- CreateIndex
CREATE UNIQUE INDEX "QueuedTask_workspaceId_idempotencyKey_key" ON "QueuedTask"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ContentVersion_workspaceId_contentItemId_createdAt_idx" ON "ContentVersion"("workspaceId", "contentItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_workspaceId_idempotencyKey_key" ON "WorkflowRun"("workspaceId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "QueuedTask" ADD CONSTRAINT "QueuedTask_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
