// @vitest-environment node
//
// Regression lock for the grant model (migrations 0010 + 0011).
//
// The shared test harness (tests/db/harness.ts) deliberately over-grants
// service_role (`grant all on all tables`) for setup convenience, which would
// mask what the migrations actually define. So this test applies the shim +
// the real migrations to a fresh PGlite WITHOUT that override, and asserts the
// exact matrices the migrations establish: service_role gets only the minimum
// each validated server workflow needs (0010), append-only tables get no
// UPDATE/DELETE, marketplace_credentials keeps its 0003 model, authenticated is
// exactly the 0002-0009 client matrix, and anon has no table DML (0011). The
// final block simulates hosted Supabase's platform-default grants and proves
// migration 0011 strips them back to least privilege (and is idempotent).
// Authoritative validation also runs against real Supabase; this keeps the
// guarantee in the offline gate too.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrationFiles } from "../db/harness";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, "..", "..", "supabase", "migrations");
const SHIM_PATH = path.resolve(HERE, "..", "db", "supabase-shim.sql");

const DML = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

let db: PGlite;

/** grantee -> table -> sorted DML privileges, from information_schema. */
async function grantMatrix(
  grantee: string,
): Promise<Record<string, string[]>> {
  const res = await db.query<{ table_name: string; privilege_type: string }>(
    `select table_name, privilege_type
       from information_schema.role_table_grants
      where grantee = $1 and table_schema = 'public'
        and privilege_type = any($2)`,
    [grantee, DML as unknown as string[]],
  );
  const out: Record<string, string[]> = {};
  for (const row of res.rows) {
    (out[row.table_name] ??= []).push(row.privilege_type);
  }
  for (const k of Object.keys(out)) out[k]!.sort();
  return out;
}

beforeAll(async () => {
  db = new PGlite();
  // Mirror harness applySchema, but WITHOUT the blanket service_role grant, so
  // we observe exactly what the migrations define.
  await db.exec(readFileSync(SHIM_PATH, "utf8"));
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
});

afterAll(async () => {
  await db?.close();
});

describe("migration 0010 — service_role privileges", () => {
  it("grants service_role exactly the minimum DML each table's workflow needs", async () => {
    const m = await grantMatrix("service_role");
    expect(m).toEqual({
      // tenancy: create org (+ returning) and read memberships; audit append-only
      organizations: ["INSERT", "SELECT"],
      organization_members: ["SELECT"],
      audit_events: ["INSERT", "SELECT"],
      // ingestion / provenance
      sync_jobs: ["INSERT", "SELECT", "UPDATE"],
      source_records: ["INSERT", "SELECT", "UPDATE"],
      source_record_rejections: ["INSERT", "SELECT"],
      sync_checkpoints: ["INSERT", "SELECT", "UPDATE"],
      // ledger: append + rebuild-delete
      marketplace_events: ["DELETE", "INSERT", "SELECT"],
      // candidates: append + rebuild-delete; evidence append-only
      recovery_candidates: ["DELETE", "INSERT", "SELECT"],
      recovery_candidate_evidence: ["INSERT", "SELECT"],
      // cases: create + state/claim updates; audit + evidence append-only
      cases: ["INSERT", "SELECT", "UPDATE"],
      case_events: ["INSERT", "SELECT"],
      case_evidence_refs: ["INSERT", "SELECT"],
      // recovery records: append-only match records
      recovery_records: ["INSERT", "SELECT"],
      // credentials: preserved from migration 0003 (full server-only DML)
      marketplace_credentials: ["DELETE", "INSERT", "SELECT", "UPDATE"],
    });
  });

  it("gives service_role no DML on marketplace_accounts (owner/RLS-owned write path)", async () => {
    const m = await grantMatrix("service_role");
    expect(m.marketplace_accounts).toBeUndefined();
  });

  it("keeps append-only tables free of service_role UPDATE/DELETE", async () => {
    const m = await grantMatrix("service_role");
    for (const t of [
      "audit_events",
      "case_events",
      "case_evidence_refs",
      "recovery_candidate_evidence",
      "recovery_records",
      "source_record_rejections",
    ]) {
      expect(m[t], t).not.toContain("UPDATE");
      expect(m[t], t).not.toContain("DELETE");
    }
  });

  it("does not broaden authenticated privileges (0002–0009 model preserved)", async () => {
    const m = await grantMatrix("authenticated");
    // Full CRUD tenancy surfaces (RLS-narrowed).
    expect(m.organizations).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    expect(m.organization_members).toEqual([
      "DELETE",
      "INSERT",
      "SELECT",
      "UPDATE",
    ]);
    expect(m.marketplace_accounts).toEqual([
      "DELETE",
      "INSERT",
      "SELECT",
      "UPDATE",
    ]);
    // audit_events: append-only for clients.
    expect(m.audit_events).toEqual(["INSERT", "SELECT"]);
    // Every ingestion/ledger/candidate/case/recovery table is read-only.
    for (const t of [
      "sync_jobs",
      "source_records",
      "source_record_rejections",
      "sync_checkpoints",
      "marketplace_events",
      "recovery_candidates",
      "recovery_candidate_evidence",
      "cases",
      "case_events",
      "case_evidence_refs",
      "recovery_records",
    ]) {
      expect(m[t], t).toEqual(["SELECT"]);
    }
    // Credentials remain revoked for authenticated.
    expect(m.marketplace_credentials).toBeUndefined();
  });

  it("grants anon no table DML at all", async () => {
    const m = await grantMatrix("anon");
    expect(m).toEqual({});
  });
});

describe("migration 0011 — strips platform-default grants (hosted parity)", () => {
  const TENANT_TABLES = [
    "organizations",
    "organization_members",
    "marketplace_accounts",
    "audit_events",
    "sync_jobs",
    "source_records",
    "source_record_rejections",
    "sync_checkpoints",
    "marketplace_events",
    "recovery_candidates",
    "recovery_candidate_evidence",
    "cases",
    "case_events",
    "case_evidence_refs",
    "recovery_records",
  ];

  let hostedLike: PGlite;

  async function matrix(
    conn: PGlite,
    grantee: string,
  ): Promise<Record<string, string[]>> {
    const res = await conn.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type
         from information_schema.role_table_grants
        where grantee = $1 and table_schema = 'public'
          and privilege_type = any($2)`,
      [grantee, DML as unknown as string[]],
    );
    const out: Record<string, string[]> = {};
    for (const row of res.rows) (out[row.table_name] ??= []).push(row.privilege_type);
    for (const k of Object.keys(out)) out[k]!.sort();
    return out;
  }

  beforeAll(async () => {
    hostedLike = new PGlite();
    await hostedLike.exec(readFileSync(SHIM_PATH, "utf8"));
    for (const file of migrationFiles()) {
      await hostedLike.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }
    // Simulate hosted Supabase's platform default privileges: broad DML to the
    // API roles + service_role on every tenant table (including marketplace_accounts).
    for (const t of [...TENANT_TABLES, "marketplace_credentials"]) {
      await hostedLike.exec(
        `grant all on public.${t} to anon, authenticated, service_role`,
      );
    }
    // Re-apply ONLY migration 0011 (as hosted would when the migration is pushed).
    const only0011 = migrationFiles().find((f) => f.startsWith("0011"))!;
    await hostedLike.exec(
      readFileSync(path.join(MIGRATIONS_DIR, only0011), "utf8"),
    );
  });

  afterAll(async () => {
    await hostedLike?.close();
  });

  it("removes all anon table DML even when platform-granted", async () => {
    expect(await matrix(hostedLike, "anon")).toEqual({});
  });

  it("restores authenticated to exactly the client matrix", async () => {
    const m = await matrix(hostedLike, "authenticated");
    expect(m.organizations).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    expect(m.organization_members).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    expect(m.marketplace_accounts).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    expect(m.audit_events).toEqual(["INSERT", "SELECT"]);
    for (const t of [
      "sync_jobs",
      "source_records",
      "source_record_rejections",
      "sync_checkpoints",
      "marketplace_events",
      "recovery_candidates",
      "recovery_candidate_evidence",
      "cases",
      "case_events",
      "case_evidence_refs",
      "recovery_records",
    ]) {
      expect(m[t], t).toEqual(["SELECT"]);
    }
    expect(m.marketplace_credentials).toBeUndefined();
  });

  it("removes the platform-default service_role DML on marketplace_accounts", async () => {
    const m = await matrix(hostedLike, "service_role");
    expect(m.marketplace_accounts).toBeUndefined();
  });

  it("keeps marketplace_credentials denied to anon and authenticated", async () => {
    expect((await matrix(hostedLike, "anon")).marketplace_credentials).toBeUndefined();
    expect(
      (await matrix(hostedLike, "authenticated")).marketplace_credentials,
    ).toBeUndefined();
  });
});
