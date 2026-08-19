import { describe, expect, it } from "vitest";

import { InvalidCaseTransitionError } from "@/core/cases/status";
import type {
  CaseEventInput,
  CaseRecord,
  CaseStore,
  ClaimSubmissionFields,
} from "@/core/cases/types";
import { MissingClaimFieldsError, submitCase } from "@/core/claims/submit";

function baseCase(over: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "case-1",
    organizationId: "org-1",
    marketplaceAccountId: "acc-1",
    recoveryCandidateId: "cand-1",
    status: "evidence_ready",
    title: "t",
    summary: "s",
    potentialRecoveryMinor: 19900,
    currency: "ZAR",
    ruleId: "MR-002",
    ruleVersion: "MR-002:v1",
    createdAt: "2026-01-01T00:00:00.000Z",
    externalReference: null,
    submittedAt: null,
    submissionDeadlineAt: null,
    disputeSlaDeadlineAt: null,
    ...over,
  };
}

class Store implements CaseStore {
  events: CaseEventInput[] = [];
  applied: (ClaimSubmissionFields & { caseId: string }) | null = null;
  constructor(private record: CaseRecord) {}
  async getCase() {
    return this.record;
  }
  async applyClaimSubmission(caseId: string, fields: ClaimSubmissionFields) {
    this.applied = { caseId, ...fields };
    this.record = { ...this.record, status: "submitted", ...fields };
  }
  async addCaseEvent(event: CaseEventInput) {
    this.events.push(event);
  }
  // Unused by submitCase.
  async getCandidate() {
    return null;
  }
  async findCaseByCandidate() {
    return null;
  }
  async createCase(): Promise<{ case: CaseRecord; created: boolean }> {
    throw new Error("unused");
  }
  async addEvidenceRefs() {}
  async updateCaseStatus() {}
  async listCases() {
    return [];
  }
}

describe("submit claim", () => {
  it("requires an external reference and a valid submission date", async () => {
    const s = new Store(baseCase());
    await expect(
      submitCase(s, { caseId: "case-1", externalReference: "", submittedAt: "2026-01-10", actorUserId: "u1" }),
    ).rejects.toBeInstanceOf(MissingClaimFieldsError);
    await expect(
      submitCase(s, { caseId: "case-1", externalReference: "TAK-1", submittedAt: "not-a-date", actorUserId: "u1" }),
    ).rejects.toBeInstanceOf(MissingClaimFieldsError);
    expect(s.applied).toBeNull();
  });

  it("only submits from evidence_ready (invalid state rejected)", async () => {
    const s = new Store(baseCase({ status: "draft" }));
    await expect(
      submitCase(s, { caseId: "case-1", externalReference: "TAK-1", submittedAt: "2026-01-10", actorUserId: "u1" }),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
  });

  it("sets both deadline clocks and records a submitted audit event", async () => {
    const s = new Store(baseCase());
    await submitCase(s, {
      caseId: "case-1",
      externalReference: "  TAK-12345  ",
      submittedAt: "2026-01-10T00:00:00.000Z",
      actorUserId: "u1",
    });
    expect(s.applied).toMatchObject({
      externalReference: "TAK-12345", // trimmed
      submittedAt: "2026-01-10T00:00:00.000Z",
      submissionDeadlineAt: "2026-01-31T00:00:00.000Z", // created + 30d
      disputeSlaDeadlineAt: "2026-01-24T00:00:00.000Z", // submitted + 14d
    });
    const submitted = s.events.find((e) => e.toStatus === "submitted");
    expect(submitted).toMatchObject({ eventType: "transition", fromStatus: "evidence_ready" });
    expect(submitted!.metadata).toMatchObject({ externalReference: "TAK-12345" });
  });
});
