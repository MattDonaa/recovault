import { describe, expect, it } from "vitest";

import {
  marketplaceAccountSchema,
  organizationSchema,
  ORG_ROLES,
} from "@/core/tenancy/schema";

describe("tenancy schema", () => {
  it("exposes the exact role set", () => {
    expect(ORG_ROLES).toEqual(["owner", "admin", "member"]);
  });

  it("validates a well-formed organization row", () => {
    const parsed = organizationSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Acme",
      slug: "acme",
      created_by: "22222222-2222-2222-2222-222222222222",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.slug).toBe("acme");
  });

  it("rejects an invalid slug", () => {
    expect(() =>
      organizationSchema.parse({
        id: "11111111-1111-1111-1111-111111111111",
        name: "Acme",
        slug: "Not Valid",
        created_by: "22222222-2222-2222-2222-222222222222",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("allows a null external_account_ref on a marketplace account", () => {
    const parsed = marketplaceAccountSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      organization_id: "22222222-2222-2222-2222-222222222222",
      marketplace: "mock",
      display_name: "Demo",
      external_account_ref: null,
      mode: "mock",
      status: "pending",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.external_account_ref).toBeNull();
  });
});
