import {
  buildEvidencePack,
  quantitiesFromCalculation,
  type EvidencePack,
} from "@/core/evidence/pack";
import { getCaseById, listCaseEvents } from "@/lib/cases/memory-store";
import { getCandidate } from "@/lib/marketplace/money-finder-store";

/**
 * Assemble a deterministic evidence pack for a case from persisted data only
 * (case + its recovery candidate + evidence events + audit timeline). Returns
 * null if the case does not belong to the organization (cross-tenant safe).
 */
export function buildCaseEvidence(
  organizationId: string,
  caseId: string,
  now: string,
): EvidencePack | null {
  const record = getCaseById(caseId);
  if (!record || record.organizationId !== organizationId) return null;

  const found = getCandidate(organizationId, record.recoveryCandidateId);
  const candidate = found?.candidate;
  const calculation = candidate?.calculation ?? {};

  const timeline = listCaseEvents(caseId).map((e) => ({
    at: e.createdAt,
    label: e.toStatus ? `${e.eventType}: ${e.toStatus}` : e.eventType,
  }));

  const sourceEvidence = (found?.evidence ?? []).map(({ role, event }) => ({
    role,
    eventKey: event.eventKey,
    sourceRecordId: event.sourceRecordId,
  }));

  return buildEvidencePack(
    {
      caseId: record.id,
      marketplace: candidate?.marketplace ?? "mock",
      marketplaceAccountId: record.marketplaceAccountId,
      ruleId: record.ruleId,
      ruleVersion: record.ruleVersion,
      confidence: candidate?.confidence ?? "UNKNOWN",
      title: record.title,
      summary: record.summary,
      sku: candidate?.sku ?? null,
      orderExternalId: null,
      externalRef: candidate?.externalRef ?? null,
      quantities: quantitiesFromCalculation(calculation),
      calculation,
      amountMinor: record.potentialRecoveryMinor,
      currency: record.currency,
      timeline,
      sourceEvidence,
      claim: record.submittedAt
        ? {
            externalReference: record.externalReference,
            submittedAt: record.submittedAt,
            submissionDeadlineAt: record.submissionDeadlineAt,
            disputeSlaDeadlineAt: record.disputeSlaDeadlineAt,
          }
        : null,
    },
    { now },
  );
}
