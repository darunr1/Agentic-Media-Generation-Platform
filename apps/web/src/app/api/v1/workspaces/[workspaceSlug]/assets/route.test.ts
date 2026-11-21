// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { ForbiddenError } from "@contentforge/shared";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  permission: vi.fn(),
  workspace: vi.fn(),
  brand: vi.fn(),
  createAsset: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@contentforge/auth", () => ({
  auth: mock.auth,
  assertWorkspacePermission: mock.permission,
}));
vi.mock("@contentforge/database", () => ({
  prisma: {
    workspace: { findUnique: mock.workspace },
    brand: { findFirst: mock.brand },
    brandAsset: { create: mock.createAsset },
  },
}));
vi.mock("@contentforge/media", () => ({
  localStorageRoot: () => "/tmp/contentforge-media-test",
  LocalObjectStorageProvider: class {
    put = mock.put;
    delete = mock.delete;
  },
}));

import { POST } from "./route";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOUi1rAwMDAxMDAwMDAAAAMyAEcmM2rsQAAAABJRU5ErkJggg==",
  "base64",
);
const url = "http://localhost:3000/api/v1/workspaces/alpha/assets";

function request({
  bytes = png,
  filename = "photo.png",
  mime = "image/png",
  brandId = "brand-a",
}: {
  bytes?: Uint8Array;
  filename?: string;
  mime?: string;
  brandId?: string;
} = {}) {
  const form = new FormData();
  form.set("brandId", brandId);
  form.set("file", new File([new Uint8Array(bytes)], filename, { type: mime }));
  return new NextRequest(url, {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
    body: form,
  });
}

async function send(req = request(), slug = "alpha") {
  return POST(req, { params: Promise.resolve({ workspaceSlug: slug }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ user: { id: "user-a" } });
  mock.workspace.mockImplementation(async ({ where }: { where: { slug: string } }) =>
    where.slug === "alpha" ? { id: "workspace-a", slug: "alpha", deletedAt: null } : null,
  );
  mock.permission.mockResolvedValue({ role: "EDITOR" });
  mock.brand.mockImplementation(
    async ({ where }: { where: { id: string; workspaceId: string } }) =>
      where.workspaceId === "workspace-a" && where.id === "brand-a" ? { id: "brand-a" } : null,
  );
  mock.put.mockResolvedValue({
    key: "workspaces/workspace-a/brands/brand-a/assets/uuid.png",
    contentType: "image/png",
    sizeBytes: png.byteLength,
    checksumSha256: "sha256",
  });
  mock.createAsset.mockResolvedValue({ id: "asset-safe-id" });
  mock.delete.mockResolvedValue(undefined);
});

describe("POST workspace image assets", () => {
  it("returns only an asset ID for an authorized brand editor", async () => {
    const response = await send();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: "asset-safe-id" } });
    expect(mock.permission).toHaveBeenCalledWith("user-a", "workspace-a", "brand:write");
    expect(mock.brand).toHaveBeenCalledWith({
      where: { id: "brand-a", workspaceId: "workspace-a", deletedAt: null },
      select: { id: true },
    });
    expect(mock.createAsset).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-a",
        brandId: "brand-a",
        kind: "PHOTO",
        originalFilename: "photo.png",
        uploadedByUserId: "user-a",
      }),
      select: { id: true },
    });
    expect(mock.put).toHaveBeenCalledOnce();
  });

  it("rejects requests without an authenticated session before querying a workspace", async () => {
    mock.auth.mockResolvedValue(null);
    const response = await send();
    expect(response.status).toBe(401);
    expect(mock.workspace).not.toHaveBeenCalled();
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-writers before reading the uploaded data", async () => {
    mock.permission.mockRejectedValue(new ForbiddenError("No write permission"));
    const response = await send();
    expect(response.status).toBe(403);
    expect(mock.brand).not.toHaveBeenCalled();
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace brand IDs and unknown workspace slugs", async () => {
    const foreignBrand = await send(request({ brandId: "brand-from-other-workspace" }));
    expect(foreignBrand.status).toBe(404);
    expect(mock.put).not.toHaveBeenCalled();
    const foreignWorkspace = await send(request(), "beta");
    expect(foreignWorkspace.status).toBe(404);
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("rejects spoofed image signatures and unsafe names", async () => {
    const fake = await send(request({ bytes: Buffer.from("not png") }));
    expect(fake.status).toBe(400);
    const traversal = await send(request({ filename: "../unsafe.png" }));
    expect(traversal.status).toBe(400);
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("rejects oversized declared bodies before parsing multipart", async () => {
    const req = request();
    req.headers.set("content-length", String(16 * 1024 * 1024));
    const response = await send(req);
    expect(response.status).toBe(400);
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("deletes orphaned bytes after a database insert failure", async () => {
    mock.createAsset.mockRejectedValue(new Error("database write failed"));
    const response = await send();
    expect(response.status).toBe(500);
    expect(mock.delete).toHaveBeenCalledWith(
      "workspaces/workspace-a/brands/brand-a/assets/uuid.png",
    );
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("database write failed");
  });
});
