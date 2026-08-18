import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Authenticated symmetric encryption for marketplace credentials
 * (AES-256-GCM). Ciphertext is tamper-evident (GCM auth tag). The key is held
 * only in the environment — never in the database, never client-side. This is
 * server-only code (Node crypto); it is never imported into a client bundle.
 *
 * Encoded format (base64url, dot-separated): `v1.<iv>.<authTag>.<ciphertext>`.
 */
const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32; // AES-256

const DEV_FALLBACK_KEY_B64 = Buffer.alloc(KEY_BYTES, 7).toString("base64");

/**
 * Resolve the 32-byte encryption key from the environment. Accepts base64 or
 * hex. Required in production; a fixed insecure key is used only outside
 * production so local/offline development and E2E work without configuration.
 */
export function getEncryptionKey(
  env: Record<string, string | undefined> = process.env,
): Buffer {
  const raw = env.MARKETPLACE_ENCRYPTION_KEY;
  if (!raw) {
    if (env.NODE_ENV === "production") {
      throw new Error("MARKETPLACE_ENCRYPTION_KEY must be set in production");
    }
    return Buffer.from(DEV_FALLBACK_KEY_B64, "base64");
  }
  const key = decodeKey(raw);
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `MARKETPLACE_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length})`,
    );
  }
  return key;
}

function decodeKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return Buffer.from(raw, "base64");
}

export function encryptSecret(
  plaintext: string,
  key: Buffer = getEncryptionKey(),
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(
  encoded: string,
  key: Buffer = getEncryptionKey(),
): string {
  const parts = encoded.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid encrypted secret format");
  }
  const [, ivB64, tagB64, dataB64] = parts as [string, string, string, string];
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(dataB64, "base64url");

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  // Throws if the auth tag does not verify (tampered ciphertext/key mismatch).
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
