import { createAnonServerClient } from "@/lib/supabase/server";
import { AuthError, type AuthProvider, type SessionUser } from "@/core/auth/types";

/**
 * Live identity provider backed by Supabase Auth (email/password). The
 * application still mints its own signed session cookie afterwards, so session
 * handling is uniform with mock mode.
 *
 * NOTE: exercised only when Supabase credentials are configured. Offline/CI
 * gates run the mock provider; this path is verified in the live milestone.
 */
export class SupabaseAuthProvider implements AuthProvider {
  async signUp(email: string, password: string): Promise<SessionUser> {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      if (/registered|exists/i.test(error?.message ?? "")) {
        throw new AuthError("email_taken", "An account with that email exists");
      }
      throw new AuthError("provider_error", error?.message ?? "Sign-up failed");
    }
    return { id: data.user.id, email: data.user.email ?? email };
  }

  async signIn(email: string, password: string): Promise<SessionUser> {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      throw new AuthError("invalid_credentials", "Invalid email or password");
    }
    return { id: data.user.id, email: data.user.email ?? email };
  }
}
