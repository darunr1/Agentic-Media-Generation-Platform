/** Reusable, dependency-free boundary validation for user-supplied image bytes. */
export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

export type ImageMimeType = "image/png" | "image/jpeg";

export interface ImageUploadInput {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ValidatedImageUpload {
  originalFilename: string;
  mimeType: ImageMimeType;
  extension: "png" | "jpg";
  bytes: Uint8Array;
}

export class ImageUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageUploadValidationError";
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const PNG_END = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82] as const;

function hasBytes(bytes: Uint8Array, signature: readonly number[], start = 0): boolean {
  return signature.every((value, index) => bytes[start + index] === value);
}

function isPng(bytes: Uint8Array): boolean {
  // An eight-byte prefix alone is not a usable PNG: require a complete IHDR and IEND.
  return (
    bytes.byteLength >= 45 &&
    hasBytes(bytes, PNG_SIGNATURE) &&
    hasBytes(bytes, [0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8) &&
    hasBytes(bytes, PNG_END, bytes.byteLength - PNG_END.length)
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 8 &&
    hasBytes(bytes, [0xff, 0xd8, 0xff]) &&
    bytes[3] >= 0xc0 &&
    bytes[3] <= 0xfe &&
    bytes[3] !== 0xd9 &&
    hasBytes(bytes, [0xff, 0xd9], bytes.byteLength - 2)
  );
}

/**
 * Validate byte length, the untrusted filename, declared MIME type, and file
 * signatures. This checks structural markers, not whether an image decoder
 * can successfully decode all pixels. Never treat the client MIME as proof.
 */
export function validateImageUpload(input: ImageUploadInput): ValidatedImageUpload {
  const { filename, contentType, bytes } = input;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new ImageUploadValidationError("An image file is required");
  }
  if (bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ImageUploadValidationError("Image exceeds the 15 MB upload limit");
  }
  if (
    typeof filename !== "string" ||
    filename.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename) ||
    filename.includes("..") ||
    filename.endsWith(".") ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(filename)
  ) {
    throw new ImageUploadValidationError("Unsafe image filename");
  }
  const extension = filename.split(".").pop()?.toLowerCase();
  const supported =
    extension === "png" && contentType === "image/png" && isPng(bytes)
      ? { mimeType: "image/png" as const, extension: "png" as const }
      : (extension === "jpg" || extension === "jpeg") &&
          contentType === "image/jpeg" &&
          isJpeg(bytes)
        ? { mimeType: "image/jpeg" as const, extension: "jpg" as const }
        : null;
  if (!supported) {
    throw new ImageUploadValidationError("Invalid PNG/JPEG signature, MIME type, or extension");
  }
  return { originalFilename: filename, ...supported, bytes };
}
