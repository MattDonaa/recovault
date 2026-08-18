import type { OrgRole } from "@/core/tenancy/schema";

/**
 * Provider-agnostic authentication + authorization contracts.
 *
 * Identity verification is delegated to an `AuthProvider` (Supabase Auth in
 * live mode; a contract-faithful mock in MOCK-FIRST/offline/test mode). The
 * application manages its own signed session cookie on top of the provider, so
 * session handling and authorization are identical across modes.
 *
 * Membership/organization access is delegated to a `MembershipStore` (the
 * Supabase database with RLS in live mode; an in-memory store in mock mode).
 */

export interface SessionUser {
  id: string;
  email: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

/** Stable, non-sensitive error codes for auth flows. */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "invalid_input"
  | "slug_taken"
  | "not_authenticated"
  | "forbidden"
  | "provider_error";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
  }
}

export interface AuthProvider {
  /** Create an identity. Throws AuthError('email_taken'|'weak_password'). */
  signUp(email: string, password: string): Promise<SessionUser>;
  /** Verify credentials. Throws AuthError('invalid_credentials'). */
  signIn(email: string, password: string): Promise<SessionUser>;
}

export interface MembershipStore {
  createOrganization(
    userId: string,
    input: { name: string; slug: string },
  ): Promise<OrganizationSummary>;
  listOrganizationsForUser(userId: string): Promise<OrganizationSummary[]>;
  /** Returns the caller's membership for an org, or null if not a member. */
  getMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationSummary | null>;
}
