import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, hashToken, safeCompare } from "./crypto";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips plaintext", () => {
    const key = randomBytes(32);
    const cipher = encryptSecret("super-secret-oauth-token", key);
    expect(decryptSecret(cipher, key)).toBe("super-secret-oauth-token");
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const key = randomBytes(32);
    const a = encryptSecret("same-input", key);
    const b = encryptSecret("same-input", key);
    expect(a.equals(b)).toBe(false);
  });

  it("fails to decrypt with the wrong key", () => {
    const key = randomBytes(32);
    const wrongKey = randomBytes(32);
    const cipher = encryptSecret("secret", key);
    expect(() => decryptSecret(cipher, wrongKey)).toThrow();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => encryptSecret("x", randomBytes(16))).toThrow();
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("safeCompare", () => {
  it("returns true for equal strings", () => {
    expect(safeCompare("hello", "hello")).toBe(true);
  });

  it("returns false for different-length strings", () => {
    expect(safeCompare("hello", "hello world")).toBe(false);
  });

  it("returns false for same-length different strings", () => {
    expect(safeCompare("hello", "world")).toBe(false);
  });
});
