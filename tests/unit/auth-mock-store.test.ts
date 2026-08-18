import { beforeEach, describe, expect, it } from "vitest";

import { AuthError } from "@/core/auth/types";
import {
  InMemoryMembershipStore,
  MockAuthProvider,
  mockAuditEvents,
  resetMockDb,
} from "@/lib/auth/mock/store";

const provider = new MockAuthProvider();
const store = new InMemoryMembershipStore();

beforeEach(() => resetMockDb());

describe("mock auth provider", () => {
  it("signs up then signs in the same user", async () => {
    const created = await provider.signUp("a@example.test", "password123");
    const signedIn = await provider.signIn("a@example.test", "password123");
    expect(signedIn.id).toBe(created.id);
  });

  it("rejects a duplicate signup", async () => {
    await provider.signUp("dup@example.test", "password123");
    await expect(
      provider.signUp("dup@example.test", "password123"),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a wrong password", async () => {
    await provider.signUp("b@example.test", "password123");
    await expect(
      provider.signIn("b@example.test", "wrong-password"),
    ).rejects.toBeInstanceOf(AuthError);
  });
});

describe("mock membership store", () => {
  it("seeds the creator as owner and lists the org", async () => {
    const user = await provider.signUp("owner@example.test", "password123");
    const org = await store.createOrganization(user.id, {
      name: "Acme",
      slug: "acme",
    });
    expect(org.role).toBe("owner");

    const orgs = await store.listOrganizationsForUser(user.id);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.id).toBe(org.id);
  });

  it("isolates membership between users", async () => {
    const a = await provider.signUp("a@example.test", "password123");
    const b = await provider.signUp("b@example.test", "password123");
    const orgA = await store.createOrganization(a.id, {
      name: "A",
      slug: "a",
    });

    expect(await store.getMembership(a.id, orgA.id)).not.toBeNull();
    expect(await store.getMembership(b.id, orgA.id)).toBeNull();
    expect(await store.listOrganizationsForUser(b.id)).toHaveLength(0);
  });

  it("records an audit event on organization creation", async () => {
    const user = await provider.signUp("c@example.test", "password123");
    const org = await store.createOrganization(user.id, {
      name: "Audited",
      slug: "audited",
    });
    const events = mockAuditEvents();
    expect(
      events.some(
        (e) =>
          e.action === "organization.created" && e.organizationId === org.id,
      ),
    ).toBe(true);
  });

  it("disambiguates duplicate slugs", async () => {
    const a = await provider.signUp("a@example.test", "password123");
    const b = await provider.signUp("b@example.test", "password123");
    const first = await store.createOrganization(a.id, {
      name: "Same",
      slug: "same",
    });
    const second = await store.createOrganization(b.id, {
      name: "Same",
      slug: "same",
    });
    expect(first.slug).toBe("same");
    expect(second.slug).not.toBe("same");
  });
});
