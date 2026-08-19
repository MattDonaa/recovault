// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

async function names(sql: string): Promise<string[]> {
  const res = await db.raw.query<{ name: string }>(sql);
  return res.rows.map((r) => r.name);
}

describe("tenancy migrations", () => {
  it("applies cleanly and creates the expected tenant tables (AC-01)", async () => {
    const tables = await names(
      `select table_name as name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by 1`,
    );
    expect(tables).toEqual([
      "audit_events",
      "case_events",
      "case_evidence_refs",
      "cases",
      "marketplace_accounts",
      "marketplace_credentials",
      "marketplace_events",
      "organization_members",
      "organizations",
      "recovery_candidate_evidence",
      "recovery_candidates",
      "source_record_rejections",
      "source_records",
      "sync_checkpoints",
      "sync_jobs",
    ]);
  });

  it("names no core table after a brand or marketplace (AC-05)", async () => {
    const tables = await names(
      `select table_name as name from information_schema.tables
       where table_schema = 'public'`,
    );
    for (const t of tables) {
      expect(t.toLowerCase()).not.toContain("recovault");
      expect(t.toLowerCase()).not.toContain("takealot");
    }
  });

  it("enables row-level security on every tenant table (AC-02 precondition)", async () => {
    const res = await db.raw.query<{ relname: string; rls: boolean }>(
      `select relname, relrowsecurity as rls
       from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'
       order by relname`,
    );
    for (const row of res.rows) {
      expect(row.rls, `RLS must be enabled on ${row.relname}`).toBe(true);
    }
  });

  it("creates required indexes and unique constraints (AC-04)", async () => {
    const indexes = await names(
      `select indexname as name from pg_indexes
       where schemaname = 'public' order by 1`,
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        "idx_organization_members_org",
        "idx_organization_members_user",
        "idx_organization_members_org_role",
        "idx_marketplace_accounts_org",
        "idx_audit_events_org_created",
        "organization_members_unique_membership",
        "marketplace_accounts_unique_ref",
        "organizations_slug_key",
      ]),
    );
  });

  it("is deterministic: a second clean build yields an identical schema", async () => {
    const introspect = `
      select 'T:'||table_name as name from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE'
      union all select 'I:'||indexname from pg_indexes where schemaname='public'
      union all select 'P:'||policyname from pg_policies where schemaname='public'
      order by 1`;
    const first = (
      await db.raw.query<{ name: string }>(introspect)
    ).rows.map((r) => r.name);

    const db2 = await createTestDb();
    try {
      const second = (
        await db2.raw.query<{ name: string }>(introspect)
      ).rows.map((r) => r.name);
      expect(second).toEqual(first);
    } finally {
      await db2.close();
    }
  });
});
