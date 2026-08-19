import { assertTransitionCase, type CaseStatus } from "@/core/cases/status";
import {
  CandidateNotAcceptedError,
  CandidateNotFoundError,
  CaseNotFoundError,
  type CaseRecord,
  type CaseStore,
} from "@/core/cases/types";

/**
 * Create a recovery case from an ACCEPTED candidate. Idempotent: a candidate
 * maps to at most one case, so a duplicate request reuses the existing case. On
 * first creation the candidate's evidence is copied into the case and a
 * `created` audit event is recorded.
 */
export async function createCaseFromCandidate(
  store: CaseStore,
  input: { candidateId: string; actorUserId: string | null; correlationId?: string | null },
): Promise<CaseRecord> {
  const candidate = await store.getCandidate(input.candidateId);
  if (!candidate) throw new CandidateNotFoundError();
  if (candidate.status !== "accepted") throw new CandidateNotAcceptedError();

  const existing = await store.findCaseByCandidate(input.candidateId);
  if (existing) return existing;

  const { case: created, created: wasCreated } = await store.createCase({
    organizationId: candidate.organizationId,
    marketplaceAccountId: candidate.marketplaceAccountId,
    recoveryCandidateId: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    potentialRecoveryMinor: candidate.potentialRecoveryMinor,
    currency: candidate.currency,
    ruleId: candidate.ruleId,
    ruleVersion: candidate.ruleVersion,
    createdBy: input.actorUserId,
  });

  if (wasCreated) {
    await store.addEvidenceRefs(created.id, candidate.organizationId, candidate.evidence);
    await store.addCaseEvent({
      organizationId: candidate.organizationId,
      caseId: created.id,
      actorUserId: input.actorUserId,
      eventType: "created",
      fromStatus: null,
      toStatus: "draft",
      reason: "Case created from accepted recovery candidate",
      correlationId: input.correlationId ?? null,
    });
  }
  return created;
}

/**
 * Apply a validated case transition and record a material audit event. Invalid
 * transitions throw (server-side enforcement).
 */
export async function transitionCase(
  store: CaseStore,
  input: {
    caseId: string;
    to: CaseStatus;
    actorUserId: string | null;
    reason?: string | null;
    correlationId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const current = await store.getCase(input.caseId);
  if (!current) throw new CaseNotFoundError();

  // Snapshot BEFORE the update: some stores return a live reference that
  // updateCaseStatus mutates in place.
  const fromStatus = current.status;
  const organizationId = current.organizationId;

  assertTransitionCase(fromStatus, input.to); // throws on invalid

  await store.updateCaseStatus(input.caseId, input.to);
  await store.addCaseEvent({
    organizationId,
    caseId: input.caseId,
    actorUserId: input.actorUserId,
    eventType: "transition",
    fromStatus,
    toStatus: input.to,
    reason: input.reason ?? null,
    metadata: input.metadata,
    correlationId: input.correlationId ?? null,
  });
}
