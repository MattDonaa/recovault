import { assertTransitionCase } from "@/core/cases/status";
import { CaseNotFoundError, type CaseStore } from "@/core/cases/types";
import {
  computeDisputeSla,
  computeSubmissionDeadline,
  DEFAULT_CLAIM_CONFIG,
  type ClaimConfig,
} from "@/core/claims/deadlines";

export class MissingClaimFieldsError extends Error {
  constructor() {
    super("Submitting a claim requires an external reference and a submission date");
    this.name = "MissingClaimFieldsError";
  }
}

/**
 * Mark a case as submitted to the marketplace (MANUALLY, by the seller). This
 * only TRACKS the submission — nothing is submitted automatically. Requires a
 * non-empty external reference and a valid submission date, sets both deadline
 * clocks (separately anchored), and records a submitted audit event.
 */
export async function submitCase(
  store: CaseStore,
  input: {
    caseId: string;
    externalReference: string;
    submittedAt: string;
    actorUserId: string | null;
    correlationId?: string | null;
    config?: ClaimConfig;
  },
): Promise<void> {
  const current = await store.getCase(input.caseId);
  if (!current) throw new CaseNotFoundError();

  // Enforce the state-machine transition into `submitted`.
  assertTransitionCase(current.status, "submitted");

  const reference = input.externalReference?.trim();
  const submittedAt = input.submittedAt?.trim();
  if (!reference || !submittedAt || Number.isNaN(Date.parse(submittedAt))) {
    throw new MissingClaimFieldsError();
  }

  const config = input.config ?? DEFAULT_CLAIM_CONFIG;
  const submissionDeadlineAt = computeSubmissionDeadline(current.createdAt, config);
  const disputeSlaDeadlineAt = computeDisputeSla(submittedAt, config);

  await store.applyClaimSubmission(input.caseId, {
    externalReference: reference,
    submittedAt,
    submissionDeadlineAt,
    disputeSlaDeadlineAt,
  });

  await store.addCaseEvent({
    organizationId: current.organizationId,
    caseId: input.caseId,
    actorUserId: input.actorUserId,
    eventType: "transition",
    fromStatus: current.status,
    toStatus: "submitted",
    reason: "Claim submitted to marketplace (manual)",
    metadata: {
      externalReference: reference,
      submittedAt,
      submissionDeadlineAt,
      disputeSlaDeadlineAt,
    },
    correlationId: input.correlationId ?? null,
  });
}
