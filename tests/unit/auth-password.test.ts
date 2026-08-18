import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/core/auth/password";

describe("password hashing", () => {
  it("does not store the plaintext password", () => {
    const hash = hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("verifies the correct password", () => {
    const hash = hashPassword("s3cret-password");
    expect(verifyPassword("s3cret-password", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPassword("s3cret-password");
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces distinct hashes for the same password (salted)", () => {
    expect(hashPassword("same")).not.toEqual(hashPassword("same"));
  });

  it("rejects a malformed stored hash", () => {
    expect(verifyPassword("x", "not-a-valid-hash")).toBe(false);
  });
});
