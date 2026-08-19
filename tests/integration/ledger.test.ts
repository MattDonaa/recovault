// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSync } from "@/core/ingestion/engine";
import { normalizeAccount, rebuildLedger } from "@/core/ledger/engine";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";
import { createSqlIngestionStore, type SqlExec } from "@/lib/ingestion/sql-store";
import { createSqlLedgerStore } from "@/lib/ledger/sql-store";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;
let owner: string;

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

async function ingest(scenarioKey: string, org: string, account: string) {
  return db.asService(async (tx) => {
    const store = createSqlIngestionStore(tx as unknown as SqlExec);
    return runSync(new MockMarketplaceAdapter(getScenario(scenarioKey)!), store, {
      organizationId: org,
      marketplaceAccountId: account,
    });
  });
}

async function normalize(org: string, account: string) {
  return db.asService(async (tx) => {
    const store = createSqlLedgerStore(tx as unknown as SqlExec);
    return normalizeAccount(store, { organizationId: org, marketplaceAccountId: account });
  });
}

async function eventTypeCounts(account: string): Promise<Record<string, number>> {
  const res = await db.raw.query<{ event_type: string; n: number }>(
    `select event_type, count(*)::int n from public.marketplace_events
     where marketplace_account_id = $1 group by event_type`,
    [account],
  );
  return Object.fromEntries(res.rows.map((r) => [r.event_type, r.n]));
}

async function eventKeys(account: string): Promise<string[]> {
  const res = await db.raw.query<{ event_key: string }>(
    `select event_key from public.marketplace_events where marketplace_account_id = $1 order by event_key`,
    [account],
  );
  return res.rows.map((r) => r.event_key);
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.seedUser("owner@example.test");
  void owner;
});

afterAll(async () => {
  await db?.close();
});

describe("ledger — scenario snapshots", () => {
  it("normalizes the healthy scenario to the expected event snapshot", async () => {
    const { org, account } = await newAccount();
    await ingest("healthy", org, account);
    const result = await normalize(org, account);
    expect(result.eventsInserted).toBe(6); // 2 sale + 1 shipment_item + 1 return + 2 payment
    expect(await eventTypeCounts(account)).toEqual({
      sale: 2,
      shipment_item: 1,
      return: 1,
      payment: 2,
    });
  });

  it("maps source transaction enums to canonical event types", async () => {
    const { org, account } = await newAccount();
    await ingest("payment-reversal", org, account);
    await normalize(org, account);
    const counts = await eventTypeCounts(account);
    // reimbursement → payment, reversal → reversal, shipment → shipment_item.
    expect(counts).toMatchObject({ payment: 1, reversal: 1, shipment_item: 1 });
  });
});

describe("ledger — idempotency & rebuild", () => {
  it("re-normalization creates no duplicates", async () => {
    const { org, account } = await newAccount();
    await ingest("healthy", org, account);
    await normalize(org, account);
    const second = await normalize(org, account);
    expect(second.eventsInserted).toBe(0);
    expect(second.eventsUnchanged).toBe(6);
    expect(await eventKeys(account)).toHaveLength(6);
  });

  it("rebuild-from-source reproduces an equivalent ledger", async () => {
    const { org, account } = await newAccount();
    await ingest("healthy", org, account);
    await normalize(org, account);
    const before = await eventKeys(account);

    await db.asService(async (tx) => {
      const store = createSqlLedgerStore(tx as unknown as SqlExec);
      return rebuildLedger(store, { organizationId: org, marketplaceAccountId: account });
    });
    const after = await eventKeys(account);
    expect(after).toEqual(before);
  });
});

describe("ledger — provenance & exactness", () => {
  it("every event traces to a source record", async () => {
    const { org, account } = await newAccount();
    await ingest("healthy", org, account);
    await normalize(org, account);
    const res = await db.raw.query<{ total: number; traced: number }>(
      `select
         (select count(*) from public.marketplace_events e where e.marketplace_account_id = $1)::int total,
         (select count(*) from public.marketplace_events e
            join public.source_records s on s.id = e.source_record_id
          where e.marketplace_account_id = $1)::int traced`,
      [account],
    );
    expect(res.rows[0]!.traced).toBe(res.rows[0]!.total);
    expect(res.rows[0]!.total).toBe(6);
  });

  it("stores exact monetary amounts as integer minor units", async () => {
    const { org, account } = await newAccount();
    await ingest("healthy", org, account);
    await normalize(org, account);
    const res = await db.raw.query<{ amount_minor: string; currency: string }>(
      `select amount_minor, currency from public.marketplace_events
       where marketplace_account_id = $1 and event_type = 'sale' limit 1`,
      [account],
    );
    // Healthy mock sale gross = 19900 minor units, exactly preserved.
    expect(Number(res.rows[0]!.amount_minor)).toBe(19900);
    expect(res.rows[0]!.currency).toBe("ZAR");
  });
});

describe("ledger — tenant isolation", () => {
  it("prevents another tenant from reading events", async () => {
    const { org, account } = await newAccount();
    await ingest("healthy", org, account);
    await normalize(org, account);

    const intruder = await db.seedUser(`intruder-${crypto.randomUUID()}@example.test`);
    const n = await db.asUser(intruder, async (tx) =>
      Number(
        (
          await tx.query<{ n: number }>(
            `select count(*)::int n from public.marketplace_events where organization_id = $1`,
            [org],
          )
        ).rows[0]!.n,
      ),
    );
    expect(n).toBe(0);
  });
});
