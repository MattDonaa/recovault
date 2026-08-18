import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Password hashing for the mock/offline auth provider (scrypt). The live
 * Supabase provider hashes server-side; this is used only by MockAuthProvider.
 * Format: `scrypt$<saltHex>$<hashHex>`.
 */

const KEY_LEN = 64;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts as [string, string, string];
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length || KEY_LEN);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
