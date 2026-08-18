import { createHmac, timingSafeEqual } from "node:crypto";

import {
  DEFAULT_SESSION_MAX_AGE_SEC,
  SESSION_COOKIE_NAME,
} from "@/core/auth/constants";
import type { SessionUser } from "@/core/auth/types";

/**
 * Stateless, signed session tokens (HMAC-SHA256). The application mints these
 * after an AuthProvider verifies credentials, so session handling is uniform
 * across auth providers. Tokens are tamper-evident and carry an expiry.
 */

export { DEFAULT_SESSION_MAX_AGE_SEC, SESSION_COOKIE_NAME };

interface SessionPayload {
  sub: string; // user id
  email: string;
  iat: number; // issued-at (epoch seconds)
  exp: number; // expiry (epoch seconds)
}

const DEV_FALLBACK_SECRET = "dev-insecure-session-secret-change-me";

/**
 * Resolve the signing secret. Required in production; a fixed insecure fallback
 * is used only outside production so local/offline development and E2E work
 * without configuration.
 */
export function getSessionSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.AUTH_SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SESSION_SECRET must be set (>=16 chars) in production",
    );
  }
  return DEV_FALLBACK_SECRET;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(
  user: SessionUser,
  options: { maxAgeSec?: number; now?: number; secret?: string } = {},
): string {
  const nowSec = Math.floor((options.now ?? Date.now()) / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    iat: nowSec,
    exp: nowSec + (options.maxAgeSec ?? DEFAULT_SESSION_MAX_AGE_SEC),
  };
  const secret = options.secret ?? getSessionSecret();
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

/** Verify signature + expiry. Returns the user, or null if invalid/expired. */
export function verifySessionToken(
  token: string | undefined | null,
  options: { now?: number; secret?: string } = {},
): SessionUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, providedSig] = parts as [string, string];

  const secret = options.secret ?? getSessionSecret();
  const expectedSig = sign(body, secret);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const nowSec = Math.floor((options.now ?? Date.now()) / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowSec) return null;
  if (!payload.sub || !payload.email) return null;

  return { id: payload.sub, email: payload.email };
}
