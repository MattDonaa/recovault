// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSync } from "@/core/ingestion/engine";
import { normalizeAccount } from "@/core/ledger/engine";
import { rebuildRecovery, runRecovery } from "@/core/recovery/engine";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";
import { createSqlIngestionStore, type SqlExec } from "@/lib/ingestion/sql-store";
import { createSqlLedgerStore } from "@/lib/ledger/sql-store";
import { createSqlRecoveryStore } from "@/lib/recovery/sql-store";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;

async function newAccount(): Promise<{ org: string; account: string }> {
  const u = await db.seedUser(`u-${crypto.randomUUID()}@example.test`);
  const org = await db.createOrg(u, "Org", `org-${crypto.randomUUID().slice(0, 8)}`);
  const account = await db.asUser(u, async (tx) =>
    (
      await tx.query<{ id: string }>(
        `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
         values ($1, 'mock', 'Mock') returning id`,
        [org],
      )
    ).rows[0]!.id,
  );
  return { org, account };
}

async function pipeline(scenarioKey: string, org: string, account: string) {
  await db.asService(async (tx) =>
    runSync(new MockMarketplaceAdapter(getScenario(scenarioKey)!), createSqlIngestionStore(tx as unknown as SqlExec), {
      organizationId: org,
      marketplaceAccountId: account,
    }),
  );
  await db.asService(async (tx) =>
    normalizeAccount(createSqlLedgerStore(tx as unknown as SqlExec), {
      organizationId: org,
      marketplaceAccountId: account,
    }),
  );
  return db.asService(async (tx) =>
    runRecovery(createSqlRecoveryStore(tx as unknown as SqlExec), {
      organizationId: org,
      marketplaceAccountId: account,
    }),
  );
}

async function candidates(account: string) {
  const res = await db.raw.query<{
    rule_id: string;
    rule_version: string;
    confidence: string;
    potential_recovery_minor: string | null;
    external_ref: string;
  }>(
    `select rule_id, rule_version, confidence, potential_recovery_minor, external_ref
     from public.recovery_candidates where marketplace_account_id = $1 order by rule_id`,
    [account],
  );
  return res.rows;
}

const EXPECTED: Record<
  string,
  { count: number; rule?: string; confidence?: string; amount?: number | null }
> = {
  healthy: { count: 0 },
  "shipment-discrepancy": { count: 1, rule: "MR-001", confidence: "HIGH", amount: null },
  "resolved-shipment": { count: 0 },
  "consistent-return": { count: 0 },
  "return-mismatch": { count: 1, rule: "MR-002", confidence: "MEDIUM", amount: 19900 },
  "stock-loss-paid": { count: 0 },
  "stock-loss-unpaid": { count: 1, rule: "MR-003", confidence: "HIGH", amount: null },
  "payment-reversal": { count: 1, rule: "MR-003", confidence: "HIGH", amount: 99500 },
  "duplicate-retry": { count: 0 },
  "malformed-payload": { count: 0 },
  "empty-account": { count: 0 },
  "large-account": { count: 0 },
};

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

describe("recovery engine — scenario truth tables (manifest match)", () => {
  for (const [scenario, exp] of Object.entries(EXPECTED)) {
    it(`${scenario} → ${exp.count} candidate(s)`, async () => {
      const { org, account } = await newAccount();
      await pipeline(scenario, org, account);
      const rows = await candidates(account);
      expect(rows).toHaveLength(exp.count);
      if (exp.count === 1) {
        expect(rows[0]!.rule_id).toBe(exp.rule);
        expect(rows[0]!.confidence).toBe(exp.confidence);
        const amount = rows[0]!.potential_recovery_minor;
        expect(amount === null ? null : Number(amount)).toBe(exp.amount);
      }
    });
  }
});

describe("recovery engine — idempotency, explainability, isolation", () => {
  it("healthy fixture produces zero candidates (no false positives)", async () => {
    const { org, account } = await newAccount();
    await pipeline("healthy", org, account);
    expect(await candidates(account)).toHaveLength(0);
  });

  it("re-running the engine creates no duplicates", async () => {
    const { org, account } = await newAccount();
    await pipeline("shipment-discrepancy", org, account);
    const second = await db.asService(async (tx) =>
      runRecovery(createSqlRecoveryStore(tx as unknown as SqlExec), {
        organizationId: org,
        marketplaceAccountId: account,
      }),
    );
    expect(second.candidatesInserted).toBe(0);
    expect(await candidates(account)).toHaveLength(1);
  });

  it("every candidate is explainable: candidate → evidence → event → source record", async () => {
    const { org, account } = await newAccount();
    await pipeline("stock-loss-unpaid", org, account);
    const res = await db.raw.query<{
      rule_version: string;
      event_type: string;
      source_record_id: string;
      external_type: string;
    }>(
      `select c.rule_version, ev.event_type, ev.source_record_id, s.external_type
       from public.recovery_candidates c
       join public.recovery_candidate_evidence link on link.recovery_candidate_id = c.id
       join public.marketplace_events ev on ev.id = link.marketplace_event_id
       join public.source_records s on s.id = ev.source_record_id
       where c.marketplace_account_id = $1`,
      [account],
    );
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows[0]!.rule_version).toBe("MR-003:v1");
    expect(res.rows[0]!.event_type).toBe("shipment_item");
    expect(res.rows[0]!.external_type).toBe("shipments");
  });

  it("rebuild reproduces the same candidates", async () => {
    const { org, account } = await newAccount();
    await pipeline("payment-reversal", org, account);
    const before = (await candidates(account)).map((r) => r.rule_id + r.external_ref);
    await db.asService(async (tx) =>
      rebuildRecovery(createSqlRecoveryStore(tx as unknown as SqlExec), {
        organizationId: org,
        marketplaceAccountId: account,
      }),
    );
    const after = (await candidates(account)).map((r) => r.rule_id + r.external_ref);
    expect(after).toEqual(before);
  });

  it("prevents another tenant from reading candidates", async () => {
    const { org, account } = await newAccount();
    await pipeline("shipment-discrepancy", org, account);
    const intruder = await db.seedUser(`intruder-${crypto.randomUUID()}@example.test`);
    const n = await db.asUser(intruder, async (tx) =>
      Number(
        (
          await tx.query<{ n: number }>(
            `select count(*)::int n from public.recovery_candidates where organization_id = $1`,
            [org],
          )
        ).rows[0]!.n,
      ),
    );
    expect(n).toBe(0);
  });
});
