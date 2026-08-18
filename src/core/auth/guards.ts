import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  createSessionToken,
  DEFAULT_SESSION_MAX_AGE_SEC,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/core/auth/session";
import { resolveOrgAccess } from "@/core/auth/authorization";
import type { OrganizationSummary, SessionUser } from "@/core/auth/types";
import { getMembershipStore } from "@/lib/auth";

/** Mint and set the session cookie (call from a server action / route handler). */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_SESSION_MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Current authenticated user, or null. Verifies the signed session cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/** Require an authenticated session; redirect to /login otherwise. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require that the current user is a member of `organizationId`. Enforced
 * server-side regardless of UI. A non-member gets a 404 (existence is not
 * disclosed to outsiders).
 */
export async function requireOrgAccess(
  organizationId: string,
): Promise<{ user: SessionUser; membership: OrganizationSummary }> {
  const user = await requireSession();
  const store = await getMembershipStore();
  try {
    const membership = await resolveOrgAccess(store, user.id, organizationId);
    return { user, membership };
  } catch {
    notFound();
  }
}
