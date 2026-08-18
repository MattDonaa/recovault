import "server-only";

import type { AuthProvider, MembershipStore } from "@/core/auth/types";
import {
  InMemoryMembershipStore,
  MockAuthProvider,
} from "@/lib/auth/mock/store";

export type AuthMode = "live" | "mock";

/**
 * Live mode requires the full Supabase configuration. Absent any of it, the
 * application runs MOCK-FIRST with the in-memory provider/store. This is the
 * only place the mode is decided.
 */
export function getAuthMode(
  env: Record<string, string | undefined> = process.env,
): AuthMode {
  const configured =
    !!env.NEXT_PUBLIC_SUPABASE_URL &&
    !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !!env.SUPABASE_SERVICE_ROLE_KEY;
  return configured ? "live" : "mock";
}

export function isMockMode(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return getAuthMode(env) === "mock";
}

export async function getAuthProvider(): Promise<AuthProvider> {
  if (getAuthMode() === "live") {
    const { SupabaseAuthProvider } = await import("@/lib/auth/supabase/provider");
    return new SupabaseAuthProvider();
  }
  return new MockAuthProvider();
}

export async function getMembershipStore(): Promise<MembershipStore> {
  if (getAuthMode() === "live") {
    const { SupabaseMembershipStore } = await import("@/lib/auth/supabase/store");
    return new SupabaseMembershipStore();
  }
  return new InMemoryMembershipStore();
}
