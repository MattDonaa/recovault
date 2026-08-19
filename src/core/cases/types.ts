import type { CaseStatus } from "@/core/cases/status";

export interface EvidenceRef {
  eventId: string;
  role: string;
}

/** The accepted-candidate snapshot the engine turns into a case. */
export interface CandidateForCase {
  id: string;
  organizationId: string;
  marketplaceAccountId: string;
  status: string; // recovery candidate status (must be 'accepted' to create)
  title: string;
  summary: string;
  potentialRecoveryMinor: number | null;
  currency: string | null;
  ruleId: string;
  ruleVersion: string;
  evidence: EvidenceRef[];
}

export interface CaseRecord {
  id: string;
  organizationId: string;
  marketplaceAccountId: string;
  recoveryCandidateId: string;
  status: CaseStatus;
  title: string;
  summary: string;
  potentialRecoveryMinor: number | null;
  currency: string | null;
  ruleId: string;
  ruleVersion: string;
  createdAt: string;
  // Manual claim tracking (set at submission).
  externalReference: string | null;
  submittedAt: string | null;
  submissionDeadlineAt: string | null;
  disputeSlaDeadlineAt: string | null;
}

export interface ClaimSubmissionFields {
  externalReference: string;
  submittedAt: string;
  submissionDeadlineAt: string;
  disputeSlaDeadlineAt: string;
}

export interface CreateCaseInput {
  organizationId: string;
  marketplaceAccountId: string;
  recoveryCandidateId: string;
  title: string;
  summary: string;
  potentialRecoveryMinor: number | null;
  currency: string | null;
  ruleId: string;
  ruleVersion: string;
  createdBy: string | null;
}

export interface CaseEventInput {
  organizationId: string;
  caseId: string;
  actorUserId: string | null;
  eventType: "created" | "transition";
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus | null;
  reason: string | null;
  metadata?: Record<string, unknown>;
  correlationId: string | null;
}

export interface CaseEventRecord extends CaseEventInput {
  id: string;
  createdAt: string;
}

export interface CaseStore {
  getCandidate(candidateId: string): Promise<CandidateForCase | null>;
  findCaseByCandidate(candidateId: string): Promise<CaseRecord | null>;
  createCase(input: CreateCaseInput): Promise<{ case: CaseRecord; created: boolean }>;
  addEvidenceRefs(
    caseId: string,
    organizationId: string,
    refs: EvidenceRef[],
  ): Promise<void>;
  addCaseEvent(event: CaseEventInput): Promise<void>;
  getCase(caseId: string): Promise<CaseRecord | null>;
  updateCaseStatus(caseId: string, to: CaseStatus): Promise<void>;
  /** Mark the case submitted and persist the claim tracking fields atomically. */
  applyClaimSubmission(caseId: string, fields: ClaimSubmissionFields): Promise<void>;
  listCases(organizationId: string): Promise<CaseRecord[]>;
}

export class CandidateNotAcceptedError extends Error {
  constructor() {
    super("Only an accepted recovery candidate can create a case");
    this.name = "CandidateNotAcceptedError";
  }
}

export class CandidateNotFoundError extends Error {
  constructor() {
    super("Recovery candidate not found");
    this.name = "CandidateNotFoundError";
  }
}

export class CaseNotFoundError extends Error {
  constructor() {
    super("Case not found");
    this.name = "CaseNotFoundError";
  }
}
