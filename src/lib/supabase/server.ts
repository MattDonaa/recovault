import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/lib/db/database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * Anonymous (RLS-enforced) server client. Row visibility is governed entirely
 * by PostgreSQL Row-Level Security based on the caller's JWT.
 */
export function createAnonServerClient(): AppSupabaseClient {
  const env = getServerEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    clientOptions,
  );
}

/**
 * Service-role client. RLS is BYPASSED — restrict to trusted server/system
 * operations. Never expose this client or its key to the browser.
 */
export function createServiceRoleClient(): AppSupabaseClient {
  const env = getServerEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    clientOptions,
  );
}
