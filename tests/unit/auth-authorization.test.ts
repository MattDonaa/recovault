import { describe, expect, it } from "vitest";

import { assertRole, resolveOrgAccess } from "@/core/auth/authorization";
import {
  AuthError,
  type MembershipStore,
  type OrganizationSummary,
} from "@/core/auth/types";

function storeWith(
  memberships: Record<string, OrganizationSummary>,
): MembershipStore {
  return {
    async createOrganization() {
      throw new Error("not used");
    },
    async listOrganizationsForUser() {
      return [];
    },
    async getMembership(userId, orgId) {
      return memberships[`${userId}:${orgId}`] ?? null;
    },
  };
}

const orgA: OrganizationSummary = {
  id: "org-a",
  name: "A",
  slug: "a",
  role: "owner",
};

describe("authorization", () => {
  it("resolves access for a member", async () => {
    const store = storeWith({ "user-1:org-a": orgA });
    await expect(resolveOrgAccess(store, "user-1", "org-a")).resolves.toEqual(
      orgA,
    );
  });

  it("denies access for a non-member", async () => {
    const store = storeWith({ "user-1:org-a": orgA });
    await expect(
      resolveOrgAccess(store, "user-2", "org-a"),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("enforces role requirements", () => {
    expect(() => assertRole(orgA, ["owner", "admin"])).not.toThrow();
    expect(() => assertRole({ ...orgA, role: "member" }, ["owner"])).toThrow(
      AuthError,
    );
  });
});
