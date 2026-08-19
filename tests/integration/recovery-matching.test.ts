// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSync } from "@/core/ingestion/engine";
import { normalizeAccount } from "@/core/ledger/engine";
import { createCaseFromCandidate, transitionCase } from "@/core/cases/engine";
import type { CaseStatus } from "@/core/cases/status";
import { runRecoveryMatching } from "@/core/recovery/match-engine";
import { runRecovery } from "@/core/recovery/engine";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";
import { createSqlIngestionStore, type SqlExec } from "@/lib/ingestion/sql-store";
import { createSqlLedgerStore } from "@/lib/ledger/sql-store";
import { createSqlRecoveryStore } from "@/lib/recovery/sql-store";
import { createSqlCaseStore } from "@/lib/cases/sql-store";
import { createSqlRecoveryMatchStore } from "@/lib/recovery/match-sql-store";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;
let owner: string;

async function setup(): Promise<{ org: string; account: string; caseId: string; lossRef: string }> {
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

  await db.asService(async (tx) =>
    runSync(new MockMarketplaceAdapter(getScenario("stock-loss-unpaid")!), createSqlIngestionStore(tx as unknown as SqlExec), {
      organizationId: org,
      marketplaceAccountId: account,
    }),
  );
  await db.asService(async (tx) =>
    normalizeAccount(createSqlLedgerStore(tx as unknown as SqlExec), { organizationId: org, marketplaceAccountId: account }),
  );
  await db.asService(async (tx) =>
    runRecovery(createSqlRecoveryStore(tx as unknown as SqlExec), { organizationId: org, marketplaceAccountId: account }),
  );

  const cand = await db.raw.query<{ id: string; external_ref: string }>(
    `select id, external_ref from public.recovery_candidates where marketplace_account_id = $1 limit 1`,
    [account],
  );
  const candidateId = cand.rows[0]!.id;
  const lossRef = cand.rows[0]!.external_ref;
  await db.asService(async (tx) => {
    await tx.query(`update public.recovery_candidates set status = 'accepted' where id = $1`, [candidateId]);
  });

  const created = await db.asService(async (tx) =>
    createCaseFromCandidate(createSqlCaseStore(tx as unknown as SqlExec), { candidateId, actorUserId: owner }),
  );

  // Advance the case to payment_expected.
  for (const to of ["evidence_ready", "submitted", "under_review", "accepted", "payment_expected"] as CaseStatus[]) {
    await db.asService(async (tx) =>
      transitionCase(createSqlCaseStore(tx as unknown as SqlExec), { caseId: created.id, to, actorUserId: owner }),
    );
  }
  return { org, account, caseId: created.id, lossRef };
}

/** Insert a synthetic reimbursement (recovery) event referencing `related`. */
async function insertReimbursement(
  org: string,
  account: string,
  externalRef: string,
  related: string,
): Promise<void> {
  const src = await db.raw.query<{ id: string }>(
    `select id from public.source_records where marketplace_account_id = $1 limit 1`,
    [account],
  );
  await db.asService(async (tx) => {
    await tx.query(
      `insert into public.marketplace_events (
         organization_id, marketplace_account_id, marketplace, event_type, external_ref,
         references_json, amount_minor, currency, source_record_id, normalizer_version, event_key
       ) values ($1, $2, 'mock', 'payment', $3, $4::jsonb, 99500, 'ZAR', $5, 'ledger:v1', $6)`,
      [
        org,
        account,
        externalRef,
        JSON.stringify({ canonicalType: "reimbursement", relatedExternalId: related }),
        src.rows[0]!.id,
        `transaction:${externalRef}`,
      ],
    );
  });
}

async function insertReversal(org: string, account: string, paymentRef: string): Promise<void> {
  const src = await db.raw.query<{ id: string }>(
    `select id from public.source_records where marketplace_account_id = $1 limit 1`,
    [account],
  );
  await db.asService(async (tx) => {
    await tx.query(
      `insert into public.marketplace_events (
         organization_id, marketplace_account_id, marketplace, event_type, external_ref,
         references_json, amount_minor, currency, source_record_id, normalizer_version, event_key
       ) values ($1, $2, 'mock', 'reversal', $3, $4::jsonb, -99500, 'ZAR', $5, 'ledger:v1', $6)`,
      [
        org,
        account,
        `rev-${paymentRef}`,
        JSON.stringify({ canonicalType: "reversal", relatedExternalId: paymentRef }),
        src.rows[0]!.id,
        `transaction:rev-${paymentRef}`,
      ],
    );
  });
}

async function match(org: string, account: string) {
  return db.asService(async (tx) =>
    runRecoveryMatching(createSqlRecoveryMatchStore(tx as unknown as SqlExec), {
      organizationId: org,
      marketplaceAccountId: account,
      actorUserId: owner,
    }),
  );
}

async function caseStatus(caseId: string): Promise<string> {
  const r = await db.raw.query<{ status: string }>(`select status from public.cases where id = $1`, [caseId]);
  return r.rows[0]!.status;
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.seedUser("owner@example.test");
});

afterAll(async () => {
  await db?.close();
});

describe("recovery matching (DB) — close the loop", () => {
  it("a valid unreversed match recovers the correct case", async () => {
    const { org, account, caseId, lossRef } = await setup();
    await insertReimbursement(org, account, "recov-1", lossRef);
    const result = await match(org, account);
    expect(result.matched).toBe(1);
    expect(result.recovered).toBe(1);
    expect(await caseStatus(caseId)).toBe("recovered");

    const rec = await db.raw.query<{ status: string }>(
      `select status from public.recovery_records where marketplace_account_id = $1 and external_ref = $2`,
      [account, lossRef],
    );
    expect(rec.rows[0]!.status).toBe("matched");
  });

  it("an unmatched payment does not close any case", async () => {
    const { org, account, caseId } = await setup();
    await insertReimbursement(org, account, "recov-x", "no-such-loss");
    const result = await match(org, account);
    expect(result.unmatched).toBe(1);
    expect(result.recovered).toBe(0);
    expect(await caseStatus(caseId)).toBe("payment_expected");
  });

  it("a reversed reimbursement does not recover the case", async () => {
    const { org, account, caseId, lossRef } = await setup();
    await insertReimbursement(org, account, "recov-r", lossRef);
    await insertReversal(org, account, "recov-r");
    const result = await match(org, account);
    expect(result.reversed).toBe(1);
    expect(result.recovered).toBe(0);
    expect(await caseStatus(caseId)).toBe("payment_expected");
  });

  it("denies another tenant access to recovery records", async () => {
    const { org, account, lossRef } = await setup();
    await insertReimbursement(org, account, "recov-t", lossRef);
    await match(org, account);
    const intruder = await db.seedUser(`intruder-${crypto.randomUUID()}@example.test`);
    const n = await db.asUser(intruder, async (tx) =>
      Number(
        (await tx.query<{ n: number }>(`select count(*)::int n from public.recovery_records where organization_id = $1`, [org])).rows[0]!.n,
      ),
    );
    expect(n).toBe(0);
  });
});
