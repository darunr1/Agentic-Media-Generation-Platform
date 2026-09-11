import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Exercises the schema against a real (embedded, throwaway) Postgres
 * instance started by src/test/global-setup.ts — validates that
 * migrations + core relations (Workspace -> WorkspaceMembership -> User,
 * cascade delete) actually work, not just that they typecheck.
 */
describe("schema smoke test", () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a workspace with an owner membership and reads it back", async () => {
    const user = await prisma.user.create({
      data: { email: `owner-${Date.now()}@example.com`, name: "Test Owner" },
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace",
        slug: `test-workspace-${Date.now()}`,
        createdByUserId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
      include: { memberships: true },
    });

    expect(workspace.memberships).toHaveLength(1);
    expect(workspace.memberships[0]?.role).toBe("OWNER");

    const found = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    });
    expect(found).not.toBeNull();
  });

  it("cascades workspace deletion to memberships", async () => {
    const user = await prisma.user.create({
      data: { email: `cascade-${Date.now()}@example.com` },
    });
    const workspace = await prisma.workspace.create({
      data: {
        name: "Cascade Test",
        slug: `cascade-test-${Date.now()}`,
        createdByUserId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });

    await prisma.workspace.delete({ where: { id: workspace.id } });

    const remaining = await prisma.workspaceMembership.findMany({
      where: { workspaceId: workspace.id },
    });
    expect(remaining).toHaveLength(0);
  });

  it("enforces the unique idempotency constraint on GenerationJob", async () => {
    const user = await prisma.user.create({ data: { email: `idem-${Date.now()}@example.com` } });
    const workspace = await prisma.workspace.create({
      data: { name: "Idempotency Test", slug: `idem-test-${Date.now()}`, createdByUserId: user.id },
    });

    const idempotencyKey = "fixed-key-for-test";
    await prisma.generationJob.create({
      data: {
        workspaceId: workspace.id,
        type: "SCRIPT",
        provider: "mock",
        model: "mock-v1",
        promptVersion: "v1",
        inputJson: {},
        idempotencyKey,
      },
    });

    await expect(
      prisma.generationJob.create({
        data: {
          workspaceId: workspace.id,
          type: "SCRIPT",
          provider: "mock",
          model: "mock-v1",
          promptVersion: "v1",
          inputJson: {},
          idempotencyKey,
        },
      }),
    ).rejects.toThrow();
  });
});
