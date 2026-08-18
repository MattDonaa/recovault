import { randomUUID } from "node:crypto";

import { hashPassword, verifyPassword } from "@/core/auth/password";
import { slugify } from "@/core/auth/validation";
import {
  AuthError,
  type AuthProvider,
  type MembershipStore,
  type OrganizationSummary,
  type SessionUser,
} from "@/core/auth/types";
import type { OrgRole } from "@/core/tenancy/schema";

/**
 * In-memory identity + membership store for MOCK-FIRST / offline / test mode.
 * It provides real behavior (hashing, membership resolution, audit records) —
 * it is a contract-faithful double for Supabase, not fake success UI.
 *
 * Persisted on globalThis so it survives Next.js dev module reloads within a
 * single server process (E2E relies on signup → login continuity).
 */
interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
}
interface MockOrg {
  id: string;
  name: string;
  slug: string;
  createdBy: string;
}
interface MockMembership {
  organizationId: string;
  userId: string;
  role: OrgRole;
}
interface MockAuditEvent {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}
interface MockDb {
  users: Map<string, MockUser>; // keyed by email
  orgs: Map<string, MockOrg>; // keyed by id
  memberships: MockMembership[];
  slugs: Set<string>;
  auditEvents: MockAuditEvent[];
}

const GLOBAL_KEY = "__recovault_mock_db__";

function db(): MockDb {
  const g = globalThis as unknown as Record<string, MockDb | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      users: new Map(),
      orgs: new Map(),
      memberships: [],
      slugs: new Set(),
      auditEvents: [],
    };
  }
  return g[GLOBAL_KEY]!;
}

/** Test helper: clear all mock state. */
export function resetMockDb(): void {
  const fresh = db();
  fresh.users.clear();
  fresh.orgs.clear();
  fresh.memberships.length = 0;
  fresh.slugs.clear();
  fresh.auditEvents.length = 0;
}

/** Test helper: read recorded audit events. */
export function mockAuditEvents(): ReadonlyArray<MockAuditEvent> {
  return db().auditEvents;
}

export class MockAuthProvider implements AuthProvider {
  async signUp(email: string, password: string): Promise<SessionUser> {
    const store = db();
    if (store.users.has(email)) {
      throw new AuthError("email_taken", "An account with that email exists");
    }
    const user: MockUser = {
      id: randomUUID(),
      email,
      passwordHash: hashPassword(password),
    };
    store.users.set(email, user);
    return { id: user.id, email: user.email };
  }

  async signIn(email: string, password: string): Promise<SessionUser> {
    const store = db();
    const user = store.users.get(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new AuthError("invalid_credentials", "Invalid email or password");
    }
    return { id: user.id, email: user.email };
  }
}

export class InMemoryMembershipStore implements MembershipStore {
  private uniqueSlug(candidate: string): string {
    const store = db();
    let slug = candidate;
    let n = 2;
    while (store.slugs.has(slug)) {
      slug = `${candidate}-${n}`.slice(0, 63);
      n += 1;
    }
    return slug;
  }

  async createOrganization(
    userId: string,
    input: { name: string; slug: string },
  ): Promise<OrganizationSummary> {
    const store = db();
    const slug = this.uniqueSlug(input.slug || slugify(input.name));
    const org: MockOrg = {
      id: randomUUID(),
      name: input.name,
      slug,
      createdBy: userId,
    };
    store.orgs.set(org.id, org);
    store.slugs.add(slug);
    // Creator is seeded as owner (mirrors the DB trigger).
    store.memberships.push({
      organizationId: org.id,
      userId,
      role: "owner",
    });
    store.auditEvents.push({
      organizationId: org.id,
      actorUserId: userId,
      action: "organization.created",
      entityType: "organization",
      entityId: org.id,
      createdAt: new Date().toISOString(),
    });
    return { id: org.id, name: org.name, slug: org.slug, role: "owner" };
  }

  async listOrganizationsForUser(
    userId: string,
  ): Promise<OrganizationSummary[]> {
    const store = db();
    return store.memberships
      .filter((m) => m.userId === userId)
      .map((m) => {
        const org = store.orgs.get(m.organizationId)!;
        return { id: org.id, name: org.name, slug: org.slug, role: m.role };
      });
  }

  async getMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationSummary | null> {
    const store = db();
    const m = store.memberships.find(
      (x) => x.userId === userId && x.organizationId === organizationId,
    );
    if (!m) return null;
    const org = store.orgs.get(organizationId);
    if (!org) return null;
    return { id: org.id, name: org.name, slug: org.slug, role: m.role };
  }
}
