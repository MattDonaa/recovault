import { describe, expect, it } from "vitest";

import { createCaseFromCandidate, transitionCase } from "@/core/cases/engine";
import {
  assertTransitionCase,
  canTransitionCase,
  InvalidCaseTransitionError,
} from "@/core/cases/status";
import {
  CandidateNotAcceptedError,
  type CandidateForCase,
  type CaseEventInput,
  type CaseRecord,
  type CaseStore,
  type CreateCaseInput,
  type EvidenceRef,
} from "@/core/cases/types";

describe("case state machine", () => {
  it("allows only valid transitions", () => {
    expect(canTransitionCase("draft", "evidence_ready")).toBe(true);
    expect(canTransitionCase("draft", "submitted")).toBe(false);
    expect(canTransitionCase("evidence_ready", "submitted")).toBe(true);
    expect(canTransitionCase("submitted", "under_review")).toBe(true);
    expect(canTransitionCase("under_review", "accepted")).toBe(true);
    expect(canTransitionCase("under_review", "disputed")).toBe(true);
    expect(canTransitionCase("accepted", "payment_expected")).toBe(true);
    expect(canTransitionCase("disputed", "payment_expected")).toBe(true);
    expect(canTransitionCase("payment_expected", "recovered")).toBe(true);
    expect(canTransitionCase("recovered", "closed")).toBe(true);
    // Forbidden
    expect(canTransitionCase("recovered", "payment_expected")).toBe(false);
    expect(canTransitionCase("closed", "draft")).toBe(false);
    expect(canTransitionCase("under_review", "recovered")).toBe(false);
  });

  it("closing is allowed from active states", () => {
    for (const s of ["draft", "evidence_ready", "submitted", "under_review", "accepted", "disputed", "payment_expected"] as const) {
      expect(canTransitionCase(s, "closed")).toBe(true);
    }
  });

  it("throws on invalid transition", () => {
    expect(() => assertTransitionCase("draft", "recovered")).toThrow(InvalidCaseTransitionError);
  });
});

class FakeCaseStore implements CaseStore {
  cases: CaseRecord[] = [];
  events: CaseEventInput[] = [];
  evidence: { caseId: string; ref: EvidenceRef }[] = [];
  constructor(private candidate: CandidateForCase | null) {}

  async getCandidate(): Promise<CandidateForCase | null> {
    return this.candidate;
  }
  async findCaseByCandidate(candidateId: string): Promise<CaseRecord | null> {
    return this.cases.find((c) => c.recoveryCandidateId === candidateId) ?? null;
  }
  async createCase(input: CreateCaseInput): Promise<{ case: CaseRecord; created: boolean }> {
    const existing = this.cases.find((c) => c.recoveryCandidateId === input.recoveryCandidateId);
    if (existing) return { case: existing, created: false };
    const rec: CaseRecord = {
      id: `case-${this.cases.length + 1}`,
      organizationId: input.organizationId,
      marketplaceAccountId: input.marketplaceAccountId,
      recoveryCandidateId: input.recoveryCandidateId,
      status: "draft",
      title: input.title,
      summary: input.summary,
      potentialRecoveryMinor: input.potentialRecoveryMinor,
      currency: input.currency,
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      createdAt: new Date().toISOString(),
      externalReference: null,
      submittedAt: null,
      submissionDeadlineAt: null,
      disputeSlaDeadlineAt: null,
    };
    this.cases.push(rec);
    return { case: rec, created: true };
  }
  async addEvidenceRefs(caseId: string, _org: string, refs: EvidenceRef[]): Promise<void> {
    for (const ref of refs) this.evidence.push({ caseId, ref });
  }
  async addCaseEvent(event: CaseEventInput): Promise<void> {
    this.events.push(event);
  }
  async getCase(caseId: string): Promise<CaseRecord | null> {
    return this.cases.find((c) => c.id === caseId) ?? null;
  }
  async updateCaseStatus(caseId: string, to: CaseRecord["status"]): Promise<void> {
    const c = this.cases.find((x) => x.id === caseId);
    if (c) c.status = to;
  }
  async applyClaimSubmission(
    caseId: string,
    fields: {
      externalReference: string;
      submittedAt: string;
      submissionDeadlineAt: string;
      disputeSlaDeadlineAt: string;
    },
  ): Promise<void> {
    const c = this.cases.find((x) => x.id === caseId);
    if (!c) return;
    c.status = "submitted";
    c.externalReference = fields.externalReference;
    c.submittedAt = fields.submittedAt;
    c.submissionDeadlineAt = fields.submissionDeadlineAt;
    c.disputeSlaDeadlineAt = fields.disputeSlaDeadlineAt;
  }
  async listCases(): Promise<CaseRecord[]> {
    return this.cases;
  }
}

const accepted: CandidateForCase = {
  id: "cand-1",
  organizationId: "org-1",
  marketplaceAccountId: "acc-1",
  status: "accepted",
  title: "Stock loss",
  summary: "…",
  potentialRecoveryMinor: 99500,
  currency: "ZAR",
  ruleId: "MR-003",
  ruleVersion: "MR-003:v1",
  evidence: [{ eventId: "evt-1", role: "loss" }],
};

describe("case engine — creation", () => {
  it("rejects a non-accepted candidate", async () => {
    const store = new FakeCaseStore({ ...accepted, status: "detected" });
    await expect(
      createCaseFromCandidate(store, { candidateId: "cand-1", actorUserId: "u1" }),
    ).rejects.toBeInstanceOf(CandidateNotAcceptedError);
    expect(store.cases).toHaveLength(0);
  });

  it("creates exactly one case from an accepted candidate, with evidence + audit", async () => {
    const store = new FakeCaseStore(accepted);
    const created = await createCaseFromCandidate(store, { candidateId: "cand-1", actorUserId: "u1" });
    expect(created.status).toBe("draft");
    expect(store.cases).toHaveLength(1);
    expect(store.evidence).toHaveLength(1);
    expect(store.events.filter((e) => e.eventType === "created")).toHaveLength(1);
  });

  it("is idempotent: a duplicate create reuses the existing case", async () => {
    const store = new FakeCaseStore(accepted);
    const first = await createCaseFromCandidate(store, { candidateId: "cand-1", actorUserId: "u1" });
    const second = await createCaseFromCandidate(store, { candidateId: "cand-1", actorUserId: "u1" });
    expect(second.id).toBe(first.id);
    expect(store.cases).toHaveLength(1);
    // No second 'created' event.
    expect(store.events.filter((e) => e.eventType === "created")).toHaveLength(1);
  });
});

describe("case engine — transitions", () => {
  it("records an audit event for a valid transition", async () => {
    const store = new FakeCaseStore(accepted);
    const c = await createCaseFromCandidate(store, { candidateId: "cand-1", actorUserId: "u1" });
    await transitionCase(store, { caseId: c.id, to: "evidence_ready", actorUserId: "u1", reason: "docs ready" });
    expect((await store.getCase(c.id))!.status).toBe("evidence_ready");
    const t = store.events.filter((e) => e.eventType === "transition");
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ fromStatus: "draft", toStatus: "evidence_ready", reason: "docs ready" });
  });

  it("rejects an invalid transition (no state change, no audit)", async () => {
    const store = new FakeCaseStore(accepted);
    const c = await createCaseFromCandidate(store, { candidateId: "cand-1", actorUserId: "u1" });
    await expect(
      transitionCase(store, { caseId: c.id, to: "recovered", actorUserId: "u1" }),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
    expect((await store.getCase(c.id))!.status).toBe("draft");
    expect(store.events.filter((e) => e.eventType === "transition")).toHaveLength(0);
  });
});
