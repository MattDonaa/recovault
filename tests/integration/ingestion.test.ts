// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSync } from "@/core/ingestion/engine";
import type { MarketplaceAdapter } from "@/core/marketplace/adapter";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";
import { createSqlIngestionStore, type SqlExec } from "@/lib/ingestion/sql-store";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;
let owner: string;
let org: string;
let account: string;

function wrapAdapter(
  base: MarketplaceAdapter,
  overrides: Partial<MarketplaceAdapter>,
): MarketplaceAdapter {
  return {
    marketplace: base.marketplace,
    mode: base.mode,
    capabilities: base.capabilities,
    verifyConnection: () => base.verifyConnection(),
    listSellerMetadata: () => base.listSellerMetadata(),
    listOffers: (p) => base.listOffers(p),
    listSales: (p) => base.listSales(p),
    listReturns: (p) => base.listReturns(p),
    listShipments: (p) => base.listShipments(p),
    listTransactions: (p) => base.listTransactions(p),
    listBalances: base.listBalances ? () => base.listBalances!() : undefined,
    ...overrides,
  };
}

/** Run a full sync inside one service-role transaction. */
async function sync(adapter: MarketplaceAdapter) {
  return db.asService(async (tx) => {
    const store = createSqlIngestionStore(tx as unknown as SqlExec);
    return runSync(adapter, store, {
      organizationId: org,
      marketplaceAccountId: account,
    });
  });
}

function adapterFor(scenarioKey: string): MarketplaceAdapter {
  return new MockMarketplaceAdapter(getScenario(scenarioKey)!);
}

async function countSourceRecords(): Promise<number> {
  const res = await db.raw.query<{ n: number }>(
    `select count(*)::int n from public.source_records where marketplace_account_id = $1`,
    [account],
  );
  return res.rows[0]!.n;
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.seedUser("owner@example.test");
  org = await db.createOrg(owner, "Org A", "org-a");
  account = await db.asUser(owner, async (tx) =>
    (
      await tx.query<{ id: string }>(
        `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
         values ($1, 'mock', 'Mock') returning id`,
        [org],
      )
    ).rows[0]!.id,
  );
});

afterAll(async () => {
  await db?.close();
});

describe("ingestion — first sync & counts", () => {
  it("inserts the expected records and job counts match persisted rows", async () => {
    const result = await sync(adapterFor("healthy"));
    expect(result.status).toBe("completed");
    expect(result.counts.recordsInserted).toBe(9); // 2+2+1+1+2+1
    expect(await countSourceRecords()).toBe(9);

    const job = await db.raw.query<{
      records_inserted: number;
      records_fetched: number;
      status: string;
    }>(`select records_inserted, records_fetched, status from public.sync_jobs where id = $1`, [
      result.syncJobId,
    ]);
    expect(job.rows[0]).toMatchObject({
      records_inserted: 9,
      records_fetched: 9,
      status: "completed",
    });
  });

  it("a second identical sync creates zero duplicates", async () => {
    const result = await sync(adapterFor("healthy"));
    expect(result.counts.recordsInserted).toBe(0);
    expect(result.counts.recordsUpdated).toBe(0);
    expect(await countSourceRecords()).toBe(9);
  });
});

describe("ingestion — provenance & version policy", () => {
  it("bumps version on change without erasing first-seen provenance", async () => {
    await db.asService(async (tx) => {
      const store = createSqlIngestionStore(tx as unknown as SqlExec);
      const job1 = await store.createSyncJob({
        organizationId: org,
        marketplaceAccountId: account,
        adapter: "mock",
      });
      const base = {
        organizationId: org,
        marketplaceAccountId: account,
        marketplace: "mock",
        externalType: "offers",
        externalId: "prov-1",
        sourceTimestamp: null,
        schemaVersion: "canonical:v1",
      };
      expect(
        await store.upsertSourceRecord({
          ...base,
          payloadHash: "hash-a",
          payload: { v: 1 },
          syncJobId: job1,
        }),
      ).toBe("inserted");

      const job2 = await store.createSyncJob({
        organizationId: org,
        marketplaceAccountId: account,
        adapter: "mock",
      });
      expect(
        await store.upsertSourceRecord({
          ...base,
          payloadHash: "hash-b",
          payload: { v: 2 },
          syncJobId: job2,
        }),
      ).toBe("updated");
      // Same payload again → unchanged.
      expect(
        await store.upsertSourceRecord({
          ...base,
          payloadHash: "hash-b",
          payload: { v: 2 },
          syncJobId: job2,
        }),
      ).toBe("unchanged");

      const row = await tx.query<{
        version: number;
        first_seen_sync_job_id: string;
        last_seen_sync_job_id: string;
        payload: unknown;
      }>(
        `select version, first_seen_sync_job_id, last_seen_sync_job_id, payload
         from public.source_records where marketplace_account_id = $1 and external_id = 'prov-1'`,
        [account],
      );
      expect(row.rows[0]!.version).toBe(2);
      expect(row.rows[0]!.first_seen_sync_job_id).toBe(job1);
      expect(row.rows[0]!.last_seen_sync_job_id).toBe(job2);
    });
  });
});

describe("ingestion — quarantine, empty, large", () => {
  let db2Org: string;
  let db2Account: string;
  let db2Owner: string;

  async function syncInto(
    accountId: string,
    orgId: string,
    adapter: MarketplaceAdapter,
  ) {
    return db.asService(async (tx) => {
      const store = createSqlIngestionStore(tx as unknown as SqlExec);
      return runSync(adapter, store, {
        organizationId: orgId,
        marketplaceAccountId: accountId,
      });
    });
  }

  beforeAll(async () => {
    db2Owner = await db.seedUser("o2@example.test");
    db2Org = await db.createOrg(db2Owner, "Org B", "org-b");
    db2Account = await db.asUser(db2Owner, async (tx) =>
      (
        await tx.query<{ id: string }>(
          `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
           values ($1, 'mock', 'Mock B') returning id`,
          [db2Org],
        )
      ).rows[0]!.id,
    );
  });

  it("quarantines malformed records (fail closed)", async () => {
    const result = await syncInto(db2Account, db2Org, adapterFor("malformed-payload"));
    expect(result.counts.recordsRejected).toBe(5);
    expect(result.counts.recordsInserted).toBe(3); // offers1 + sales1 + balances1

    const rej = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.source_record_rejections where marketplace_account_id = $1`,
      [db2Account],
    );
    expect(rej.rows[0]!.n).toBe(5);
  });

  it("completes an empty account cleanly", async () => {
    const owner3 = await db.seedUser("o3@example.test");
    const org3 = await db.createOrg(owner3, "Org C", "org-c");
    const account3 = await db.asUser(owner3, async (tx) =>
      (
        await tx.query<{ id: string }>(
          `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
           values ($1, 'mock', 'Mock C') returning id`,
          [org3],
        )
      ).rows[0]!.id,
    );
    const result = await syncInto(account3, org3, adapterFor("empty-account"));
    expect(result.status).toBe("completed");
    expect(result.counts.recordsInserted).toBe(0);
  });

  it("completes a large paginated account", async () => {
    const owner4 = await db.seedUser("o4@example.test");
    const org4 = await db.createOrg(owner4, "Org D", "org-d");
    const account4 = await db.asUser(owner4, async (tx) =>
      (
        await tx.query<{ id: string }>(
          `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
           values ($1, 'mock', 'Mock D') returning id`,
          [org4],
        )
      ).rows[0]!.id,
    );
    const result = await syncInto(account4, org4, adapterFor("large-account"));
    expect(result.status).toBe("completed");
    // offers20 + sales137 + transactions137 + balances1
    expect(result.counts.recordsInserted).toBe(295);
  });
});

describe("ingestion — retry safety & diagnostics", () => {
  let orgR: string;
  let accountR: string;

  beforeAll(async () => {
    const ownerR = await db.seedUser("or@example.test");
    orgR = await db.createOrg(ownerR, "Org R", "org-r");
    accountR = await db.asUser(ownerR, async (tx) =>
      (
        await tx.query<{ id: string }>(
          `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
           values ($1, 'mock', 'Mock R') returning id`,
          [orgR],
        )
      ).rows[0]!.id,
    );
  });

  it("records sanitized diagnostics on failure (no secrets)", async () => {
    const failing = wrapAdapter(adapterFor("healthy"), {
      listTransactions: async () => {
        throw new Error("upstream auth failed");
      },
    });
    const result = await db.asService(async (tx) => {
      const store = createSqlIngestionStore(tx as unknown as SqlExec);
      return runSync(failing, store, {
        organizationId: orgR,
        marketplaceAccountId: accountR,
      });
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toBe("upstream auth failed");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("retries consistently after an interrupted sync (no duplicates)", async () => {
    // First attempt failed at transactions (above), leaving partial data.
    const before = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.source_records where marketplace_account_id = $1`,
      [accountR],
    );
    expect(before.rows[0]!.n).toBeGreaterThan(0); // offers/sales/returns/shipments persisted

    // Retry with a healthy adapter → full set, idempotent.
    const result = await db.asService(async (tx) => {
      const store = createSqlIngestionStore(tx as unknown as SqlExec);
      return runSync(adapterFor("healthy"), store, {
        organizationId: orgR,
        marketplaceAccountId: accountR,
      });
    });
    expect(result.status).toBe("completed");

    const after = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.source_records where marketplace_account_id = $1`,
      [accountR],
    );
    expect(after.rows[0]!.n).toBe(9); // full healthy set, no duplicates
  });
});

describe("ingestion — tenant isolation", () => {
  it("lets a member read their org's source records", async () => {
    const n = await db.asUser(owner, async (tx) => {
      const res = await tx.query<{ n: number }>(
        `select count(*)::int n from public.source_records where organization_id = $1`,
        [org],
      );
      return Number(res.rows[0]!.n);
    });
    expect(n).toBeGreaterThan(0);
  });

  it("prevents another tenant from reading source records or sync jobs", async () => {
    const intruder = await db.seedUser("intruder@example.test");
    const records = await db.asUser(intruder, async (tx) =>
      Number(
        (
          await tx.query<{ n: number }>(
            `select count(*)::int n from public.source_records where organization_id = $1`,
            [org],
          )
        ).rows[0]!.n,
      ),
    );
    const jobs = await db.asUser(intruder, async (tx) =>
      Number(
        (
          await tx.query<{ n: number }>(
            `select count(*)::int n from public.sync_jobs where organization_id = $1`,
            [org],
          )
        ).rows[0]!.n,
      ),
    );
    expect(records).toBe(0);
    expect(jobs).toBe(0);
  });
});
