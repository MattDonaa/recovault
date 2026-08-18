import { z } from "zod";

/**
 * Environment validation boundary.
 *
 * Milestone 01 scope: only non-secret, application-level configuration is
 * validated here. Supabase and marketplace-credential variables are introduced
 * (server-only, never in client bundles) in their assigned milestones.
 *
 * Marketplace secrets MUST NOT be added to any `NEXT_PUBLIC_*` variable.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("RecoVault"),
  NEXT_PUBLIC_APP_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate the given environment record. Exported for testability.
 * Fails closed: an invalid environment throws rather than silently degrading.
 */
export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const parsed = envSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    NEXT_PUBLIC_APP_NAME: source.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_ENV: source.NEXT_PUBLIC_APP_ENV,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return parsed.data;
}

export const env: Env = parseEnv();
