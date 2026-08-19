// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSync } from "@/core/ingestion/engine";
import { normalizeAccount } from "@/core/ledger/engine";
import { createCaseFromCandidate, transitionCase } from "@/core/cases/engine";
import { CandidateNotAcceptedError } from "@/core/cases/types";
import { InvalidCaseTransitionError } from "@/core/cases/status";
import { submitCase } from "@/core/claims/submit";
import { runRecovery } from "@/core/recovery/engine";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import { getScenario } from "@/integrations/mock/fixtures";
import { createSqlIngestionStore, type SqlExec } from "@/lib/ingestion/sql-store";
import { createSqlLedgerStore } from "@/lib/ledger/sql-store";
import { createSqlRecoveryStore } from "@/lib/recovery/sql-store";
import { createSqlCaseStore } from "@/lib/cases/sql-store";

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

async function pipelineCandidate(scenario: string, org: string, account: string): Promise<string> {
  await db.asService(async (tx) =>
    runSync(new MockMarketplaceAdapter(getScenario(scenario)!), createSqlIngestionStore(tx as unknown as SqlExec), {
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
  const res = await db.raw.query<{ id: string }>(
    `select id from public.recovery_candidates where marketplace_account_id = $1 limit 1`,
    [account],
  );
  return res.rows[0]!.id;
}

async function accept(candidateId: string): Promise<void> {
  await db.asService(async (tx) => {
    await tx.query(`update public.recovery_candidates set status = 'accepted' where id = $1`, [candidateId]);
  });
}

async function createCase(candidateId: string) {
  return db.asService(async (tx) =>
    createCaseFromCandidate(createSqlCaseStore(tx as unknown as SqlExec), {
      candidateId,
      actorUserId: owner,
    }),
  );
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.seedUser("owner@example.test");
});

afterAll(async () => {
  await db?.close();
});

describe("case engine (DB) — creation & idempotency", () => {
  it("rejects a non-accepted candidate", async () => {
    const { org, account } = await newAccount();
    const candidateId = await pipelineCandidate("stock-loss-unpaid", org, account);
    // candidate status is 'detected'
    await expect(createCase(candidateId)).rejects.toBeInstanceOf(CandidateNotAcceptedError);
    const n = await db.raw.query<{ n: number }>(`select count(*)::int n from public.cases`);
    expect(Number(n.rows[0]!.n)).toBe(0);
  });

  it("creates exactly one case from an accepted candidate, with evidence + audit", async () => {
    const { org, account } = await newAccount();
    const candidateId = await pipelineCandidate("stock-loss-unpaid", org, account);
    await accept(candidateId);
    const created = await createCase(candidateId);
    expect(created.status).toBe("draft");

    const evidence = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.case_evidence_refs where case_id = $1`,
      [created.id],
    );
    expect(Number(evidence.rows[0]!.n)).toBeGreaterThan(0);

    const createdEvents = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.case_events where case_id = $1 and event_type = 'created'`,
      [created.id],
    );
    expect(Number(createdEvents.rows[0]!.n)).toBe(1);
  });

  it("is idempotent: duplicate create reuses the existing case", async () => {
    const { org, account } = await newAccount();
    const candidateId = await pipelineCandidate("stock-loss-unpaid", org, account);
    await accept(candidateId);
    const first = await createCase(candidateId);
    const second = await createCase(candidateId);
    expect(second.id).toBe(first.id);

    const count = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.cases where recovery_candidate_id = $1`,
      [candidateId],
    );
    expect(Number(count.rows[0]!.n)).toBe(1);
  });
});

describe("case engine (DB) — transitions, audit, evidence, isolation", () => {
  it("advances through valid transitions, auditing each, and rejects invalid ones", async () => {
    const { org, account } = await newAccount();
    const candidateId = await pipelineCandidate("stock-loss-unpaid", org, account);
    await accept(candidateId);
    const c = await createCase(candidateId);

    for (const to of ["evidence_ready", "submitted", "under_review", "accepted", "payment_expected", "recovered"] as const) {
      await db.asService(async (tx) =>
        transitionCase(createSqlCaseStore(tx as unknown as SqlExec), { caseId: c.id, to, actorUserId: owner }),
      );
    }
    const status = await db.raw.query<{ status: string }>(`select status from public.cases where id = $1`, [c.id]);
    expect(status.rows[0]!.status).toBe("recovered");

    const transitions = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.case_events where case_id = $1 and event_type = 'transition'`,
      [c.id],
    );
    expect(Number(transitions.rows[0]!.n)).toBe(6);

    // Invalid transition rejected (recovered → payment_expected).
    await expect(
      db.asService(async (tx) =>
        transitionCase(createSqlCaseStore(tx as unknown as SqlExec), { caseId: c.id, to: "payment_expected", actorUserId: owner }),
      ),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
  });

  it("tracks a manual claim submission with separate deadlines and an audit event", async () => {
    const { org, account } = await newAccount();
    const candidateId = await pipelineCandidate("stock-loss-unpaid", org, account);
    await accept(candidateId);
    const c = await createCase(candidateId);

    // draft → evidence_ready, then submit the claim.
    await db.asService(async (tx) =>
      transitionCase(createSqlCaseStore(tx as unknown as SqlExec), { caseId: c.id, to: "evidence_ready", actorUserId: owner }),
    );
    await db.asService(async (tx) =>
      submitCase(createSqlCaseStore(tx as unknown as SqlExec), {
        caseId: c.id,
        externalReference: "TAK-9999",
        submittedAt: "2026-01-10T00:00:00.000Z",
        actorUserId: owner,
      }),
    );

    const row = await db.raw.query<{
      status: string;
      external_reference: string;
      submitted_at: string;
      submission_deadline_at: string;
      dispute_sla_deadline_at: string;
    }>(
      `select status, external_reference, submitted_at, submission_deadline_at, dispute_sla_deadline_at
       from public.cases where id = $1`,
      [c.id],
    );
    expect(row.rows[0]!.status).toBe("submitted");
    expect(row.rows[0]!.external_reference).toBe("TAK-9999");
    // Separate clocks: submission deadline (created+30d) ≠ dispute SLA (submitted+14d).
    expect(row.rows[0]!.submission_deadline_at).not.toBe(row.rows[0]!.dispute_sla_deadline_at);

    const submitted = await db.raw.query<{ n: number }>(
      `select count(*)::int n from public.case_events where case_id = $1 and to_status = 'submitted'`,
      [c.id],
    );
    expect(Number(submitted.rows[0]!.n)).toBe(1);
  });

  it("keeps candidate evidence traceable through the case", async () => {
    const { org, account } = await newAccount();
    const candidateId = await pipelineCandidate("stock-loss-unpaid", org, account);
    await accept(candidateId);
    const c = await createCase(candidateId);

    const traced = await db.raw.query<{ n: number }>(
      `select count(*)::int n
       from public.cases cs
       join public.case_evidence_refs r on r.case_id = cs.id
       join public.marketplace_events ev on ev.id = r.marketplace_event_id
       join public.source_records s on s.id = ev.source_record_id
       where cs.id = $1`,
      [c.id],
    );
    expect(Number(traced.rows[0]!.n)).toBeGreaterThan(0);
  });

  it("denies another tenant access to cases and case events", async () => {
    const { org, account } = await newAccount();
    const candidateId = await pipelineCandidate("stock-loss-unpaid", org, account);
    await accept(candidateId);
    await createCase(candidateId);

    const intruder = await db.seedUser(`intruder-${crypto.randomUUID()}@example.test`);
    const cases = await db.asUser(intruder, async (tx) =>
      Number((await tx.query<{ n: number }>(`select count(*)::int n from public.cases where organization_id = $1`, [org])).rows[0]!.n),
    );
    const events = await db.asUser(intruder, async (tx) =>
      Number((await tx.query<{ n: number }>(`select count(*)::int n from public.case_events where organization_id = $1`, [org])).rows[0]!.n),
    );
    expect(cases).toBe(0);
    expect(events).toBe(0);
  });
});
