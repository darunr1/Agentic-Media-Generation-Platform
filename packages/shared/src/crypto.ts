import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * AES-256-GCM at-rest encryption for anything the schema stores as
 * `Bytes` (OAuth access/refresh tokens, API secrets). Layout:
 * `iv (12B) || authTag (16B) || ciphertext`. The key must be exactly 32
 * bytes — `loadEnv()` validates this before anything else runs, so a
 * misconfigured key fails at boot, not on the first token write.
 */
export function encryptSecret(plaintext: string, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error("encryptSecret: key must be 32 bytes");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptSecret(payload: Buffer, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error("decryptSecret: key must be 32 bytes");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptionKeyFromBase64(base64Key: string): Buffer {
  return Buffer.from(base64Key, "base64");
}

/** One-way hash for tokens we need to look up but never need to decrypt back
 * (invitation tokens, external approval-link tokens, API keys). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time comparison for webhook signatures / token verification. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
