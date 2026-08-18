import type { OrgRole } from "@/core/tenancy/schema";
import {
  AuthError,
  type MembershipStore,
  type OrganizationSummary,
} from "@/core/auth/types";

/**
 * Server-side authorization. This is the single source of truth for whether a
 * user may act within an organization — enforced independently of any UI. A
 * user with no membership row for the organization is denied.
 */
export async function resolveOrgAccess(
  store: MembershipStore,
  userId: string,
  organizationId: string,
): Promise<OrganizationSummary> {
  const membership = await store.getMembership(userId, organizationId);
  if (!membership) {
    throw new AuthError("forbidden", "No access to this organization");
  }
  return membership;
}

export function hasRole(
  membership: OrganizationSummary,
  allowed: readonly OrgRole[],
): boolean {
  return allowed.includes(membership.role);
}

export function assertRole(
  membership: OrganizationSummary,
  allowed: readonly OrgRole[],
): void {
  if (!hasRole(membership, allowed)) {
    throw new AuthError("forbidden", "Insufficient role");
  }
}
