// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;
let userA: string;
let userB: string;
let orgA: string;
let orgB: string;

beforeAll(async () => {
  db = await createTestDb();
  userA = await db.seedUser("a@example.test");
  userB = await db.seedUser("b@example.test");
  orgA = await db.createOrg(userA, "Org A", "org-a");
  orgB = await db.createOrg(userB, "Org B", "org-b");

  // Each owner adds a marketplace account + an audit event to their own org.
  await db.asUser(userA, async (tx) => {
    await tx.query(
      `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
       values ($1, 'mock', 'Org A Mock')`,
      [orgA],
    );
    await tx.query(
      `insert into public.audit_events (organization_id, actor_user_id, action, entity_type)
       values ($1, $2, 'org.created', 'organization')`,
      [orgA, userA],
    );
  });
  await db.asUser(userB, async (tx) => {
    await tx.query(
      `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
       values ($1, 'mock', 'Org B Mock')`,
      [orgB],
    );
    await tx.query(
      `insert into public.audit_events (organization_id, actor_user_id, action, entity_type)
       values ($1, $2, 'org.created', 'organization')`,
      [orgB, userB],
    );
  });
});

afterAll(async () => {
  await db?.close();
});

async function countAs(userId: string, sql: string, params: unknown[] = []) {
  return db.asUser(userId, async (tx) => {
    const res = await tx.query<{ n: number }>(sql, params);
    return Number(res.rows[0]!.n);
  });
}

describe("RLS: owner seeding", () => {
  it("auto-creates the creator as owner of a new organization", async () => {
    const owner = await db.asUser(userA, async (tx) =>
      (
        await tx.query<{ role: string }>(
          `select role from public.organization_members
           where organization_id = $1 and user_id = $2`,
          [orgA, userA],
        )
      ).rows[0]?.role,
    );
    expect(owner).toBe("owner");
  });
});

describe("RLS: cross-tenant read isolation (AC-02/AC-03)", () => {
  it("a user sees only their own organization", async () => {
    expect(await countAs(userA, `select count(*)::int n from public.organizations`)).toBe(1);
    expect(
      await countAs(userA, `select count(*)::int n from public.organizations where id = $1`, [orgB]),
    ).toBe(0);
  });

  it("a user cannot read another org's members", async () => {
    expect(
      await countAs(
        userA,
        `select count(*)::int n from public.organization_members where organization_id = $1`,
        [orgB],
      ),
    ).toBe(0);
  });

  it("a user cannot read another org's marketplace accounts", async () => {
    expect(
      await countAs(
        userA,
        `select count(*)::int n from public.marketplace_accounts where organization_id = $1`,
        [orgB],
      ),
    ).toBe(0);
    expect(await countAs(userA, `select count(*)::int n from public.marketplace_accounts`)).toBe(1);
  });

  it("a user cannot read another org's audit events", async () => {
    expect(
      await countAs(
        userA,
        `select count(*)::int n from public.audit_events where organization_id = $1`,
        [orgB],
      ),
    ).toBe(0);
  });
});

describe("RLS: cross-tenant write denial (AC-03)", () => {
  it("cannot update another org's row", async () => {
    const affected = await db.asUser(userA, async (tx) => {
      const res = await tx.query(
        `update public.organizations set name = 'HACKED' where id = $1`,
        [orgB],
      );
      return res.affectedRows ?? 0;
    });
    expect(affected).toBe(0);
    // Confirm B's org is untouched (checked as B).
    const bName = await db.asUser(userB, async (tx) =>
      (
        await tx.query<{ name: string }>(
          `select name from public.organizations where id = $1`,
          [orgB],
        )
      ).rows[0]?.name,
    );
    expect(bName).toBe("Org B");
  });

  it("cannot delete another org's marketplace account", async () => {
    const affected = await db.asUser(userA, async (tx) => {
      const res = await tx.query(
        `delete from public.marketplace_accounts where organization_id = $1`,
        [orgB],
      );
      return res.affectedRows ?? 0;
    });
    expect(affected).toBe(0);
  });

  it("cannot insert a marketplace account into another org (WITH CHECK)", async () => {
    await expect(
      db.asUser(userA, (tx) =>
        tx.query(
          `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
           values ($1, 'mock', 'intruder')`,
          [orgB],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("cannot add itself as a member of another org", async () => {
    await expect(
      db.asUser(userA, (tx) =>
        tx.query(
          `insert into public.organization_members (organization_id, user_id, role)
           values ($1, $2, 'admin')`,
          [orgB, userA],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("audit events are append-only: update/delete are denied for end users", async () => {
    await expect(
      db.asUser(userA, (tx) =>
        tx.query(`update public.audit_events set action = 'tamper' where organization_id = $1`, [orgA]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.asUser(userA, (tx) =>
        tx.query(`delete from public.audit_events where organization_id = $1`, [orgA]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("RLS: unauthenticated + service role", () => {
  it("denies anonymous read access to tenant tables", async () => {
    // Defense in depth: `anon` holds no table grant, so access is refused
    // before RLS is even consulted.
    await expect(
      db.asAnon((tx) =>
        tx.query(`select count(*)::int n from public.organizations`),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("denies anonymous insert of an organization", async () => {
    await expect(
      db.asAnon((tx) =>
        tx.query(
          `insert into public.organizations (name, slug) values ('x', 'x-anon')`,
        ),
      ),
    ).rejects.toThrow();
  });

  it("service role bypasses RLS for trusted server operations", async () => {
    const n = await db.asService(async (tx) => {
      const res = await tx.query<{ n: number }>(
        `select count(*)::int n from public.organizations`,
      );
      return Number(res.rows[0]!.n);
    });
    expect(n).toBe(2);
  });
});
