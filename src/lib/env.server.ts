import { z } from "zod";

/**
 * Server-only environment validation for privileged/backend configuration.
 *
 * Parsed lazily (never at module load) so that builds and tests without a live
 * Supabase project do not fail. Fail-closed: missing/invalid values throw at
 * the point of use. The service-role key is a secret and MUST remain
 * server-only — it is never exposed to the browser or a NEXT_PUBLIC_* name.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment configuration: ${issues}`);
  }

  return parsed.data;
}

/**
 * The environment variables a real production deployment MUST provide. Used by
 * the production readiness check (and documented in the deployment runbook).
 */
export const REQUIRED_PRODUCTION_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_SESSION_SECRET",
  "MARKETPLACE_ENCRYPTION_KEY",
] as const;

/**
 * Assert all required production env vars are present. Not invoked at build
 * time (mock-first builds run without them); call at server startup in a real
 * production deployment. Fails closed with the list of what is missing.
 */
export function validateProductionEnv(
  source: Record<string, string | undefined> = process.env,
): void {
  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => {
    const value = source[key];
    return !value || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }
}
