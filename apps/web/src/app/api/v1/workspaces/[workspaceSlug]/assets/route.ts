import { randomUUID } from "node:crypto";

import { assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { LocalObjectStorageProvider, localStorageRoot } from "@contentforge/media";
import {
  ImageUploadValidationError,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageUpload,
} from "@contentforge/media/upload-validation";
import { NotFoundError, ValidationError } from "@contentforge/shared";
import type { NextRequest } from "next/server";

import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";

// Leave small headroom for multipart boundaries and brandId metadata, while
// limiting memory consumption even when Content-Length is absent or forged.
const MAX_MULTIPART_BYTES = MAX_IMAGE_UPLOAD_BYTES + 64 * 1024;

async function readBoundedMultipart(req: NextRequest): Promise<FormData> {
  const contentType = req.headers.get("content-type") ?? "";
  if (
    !contentType.toLowerCase().startsWith("multipart/form-data;") ||
    !/boundary=/i.test(contentType)
  ) {
    throw new ValidationError("Expected multipart/form-data with a boundary");
  }
  const declared = req.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_MULTIPART_BYTES)) {
    throw new ValidationError("Image upload body exceeds the 15 MB limit");
  }
  const reader = req.body?.getReader();
  if (!reader) throw new ValidationError("An upload body is required");

  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new ValidationError("Image upload body exceeds the 15 MB limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const payload = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Request(req.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: payload,
    }).formData();
  } catch {
    throw new ValidationError("Malformed multipart upload");
  }
}

/** POST multipart/form-data with one file and a brandId. Returns only the asset ID. */
export const POST = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "brand:write");

  const form = await readBoundedMultipart(req);
  const brandId = form.get("brandId");
  const files = form.getAll("file");
  if (typeof brandId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(brandId)) {
    throw new ValidationError("A valid brandId is required");
  }
  if (files.length !== 1 || !(files[0] instanceof File)) {
    throw new ValidationError("Exactly one image file is required");
  }

  // Enforce the workspace constraint on the brand query; IDs in the multipart
  // body must never be enough to attach an asset to a different tenant.
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId: workspace.id, deletedAt: null },
    select: { id: true },
  });
  if (!brand) throw new NotFoundError("Brand");

  const file = files[0];
  if (file.size === 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ValidationError("Image must be nonempty and at most 15 MB");
  }
  let image;
  try {
    image = validateImageUpload({
      filename: file.name,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (error) {
    if (error instanceof ImageUploadValidationError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }

  const key = `workspaces/${workspace.id}/brands/${brand.id}/assets/${randomUUID()}.${image.extension}`;
  const storage = new LocalObjectStorageProvider(localStorageRoot());
  const uploaded = await storage.put(key, image.bytes, image.mimeType);
  try {
    const asset = await prisma.brandAsset.create({
      data: {
        workspaceId: workspace.id,
        brandId: brand.id,
        kind: "PHOTO",
        storageKey: uploaded.key,
        originalFilename: image.originalFilename,
        mimeType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        checksumSha256: uploaded.checksumSha256,
        uploadedByUserId: userId,
      },
      select: { id: true },
    });
    return jsonOk({ id: asset.id }, 201);
  } catch (error) {
    // Avoid orphaning stored bytes if the database insert fails.
    await storage.delete(uploaded.key).catch(() => undefined);
    throw error;
  }
});
