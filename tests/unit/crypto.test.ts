import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  getEncryptionKey,
} from "@/core/security/crypto";

const KEY = getEncryptionKey({
  MARKETPLACE_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
});
const OTHER_KEY = getEncryptionKey({
  MARKETPLACE_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
});

describe("credential encryption", () => {
  it("produces ciphertext that differs from the plaintext", () => {
    const secret = "super-secret-api-key-12345";
    const encoded = encryptSecret(secret, KEY);
    expect(encoded).not.toContain(secret);
    expect(encoded.startsWith("v1.")).toBe(true);
  });

  it("round-trips encrypt → decrypt", () => {
    const secret = "another-secret-value";
    expect(decryptSecret(encryptSecret(secret, KEY), KEY)).toBe(secret);
  });

  it("uses a random IV (same plaintext → different ciphertext)", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
  });

  it("fails to decrypt with the wrong key", () => {
    const encoded = encryptSecret("secret", KEY);
    expect(() => decryptSecret(encoded, OTHER_KEY)).toThrow();
  });

  it("detects tampering (GCM auth tag)", () => {
    const encoded = encryptSecret("secret", KEY);
    const parts = encoded.split(".");
    const tamperedData = Buffer.from("evil").toString("base64url");
    const tampered = [parts[0], parts[1], parts[2], tamperedData].join(".");
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it("validates the key length and encoding", () => {
    expect(() =>
      getEncryptionKey({ MARKETPLACE_ENCRYPTION_KEY: "too-short" }),
    ).toThrow(/32 bytes/);
    // 64 hex chars decode to 32 bytes.
    expect(getEncryptionKey({ MARKETPLACE_ENCRYPTION_KEY: "aa".repeat(32) }).length).toBe(32);
  });

  it("requires the key in production but allows a dev fallback otherwise", () => {
    expect(() =>
      getEncryptionKey({ NODE_ENV: "production", MARKETPLACE_ENCRYPTION_KEY: "" }),
    ).toThrow(/MARKETPLACE_ENCRYPTION_KEY/);
    expect(getEncryptionKey({ NODE_ENV: "development" }).length).toBe(32);
  });
});
