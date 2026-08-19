/**
 * Structured, deterministic evidence pack. Built ONLY from persisted
 * case/candidate/source data — no fabrication, no LLM. Money stays exact
 * integer minor units. The disclaimer makes clear a candidate is evidence-based
 * and not a guarantee of marketplace liability.
 */
export const EVIDENCE_DISCLAIMER =
  "This recovery candidate is evidence-based and is not a guarantee of marketplace liability. " +
  "Amounts shown are potential recovery derived from deterministic rules applied to your own " +
  "marketplace data — they are not established liabilities. Submit and pursue any claim at your discretion.";

export interface EvidenceSourceRef {
  role: string;
  eventKey: string;
  sourceRecordId: string;
}

export interface EvidenceTimelineEntry {
  at: string;
  label: string;
}

export interface EvidenceClaim {
  externalReference: string | null;
  submittedAt: string | null;
  submissionDeadlineAt: string | null;
  disputeSlaDeadlineAt: string | null;
}

export interface EvidencePackInput {
  caseId: string;
  marketplace: string;
  marketplaceAccountId: string;
  ruleId: string;
  ruleVersion: string;
  confidence: string;
  title: string;
  summary: string;
  sku: string | null;
  orderExternalId: string | null;
  externalRef: string | null;
  quantities: Record<string, number>;
  calculation: Record<string, unknown>;
  amountMinor: number | null;
  currency: string | null;
  timeline: EvidenceTimelineEntry[];
  sourceEvidence: EvidenceSourceRef[];
  claim: EvidenceClaim | null;
}

export interface EvidencePack extends EvidencePackInput {
  generatedAt: string;
  disclaimer: string;
}

/**
 * Assemble the evidence pack. Pure: given the persisted inputs it returns the
 * exact same values plus a generated-at timestamp and the fixed disclaimer.
 */
export function buildEvidencePack(
  input: EvidencePackInput,
  options: { now: string },
): EvidencePack {
  return {
    ...input,
    generatedAt: options.now,
    disclaimer: EVIDENCE_DISCLAIMER,
  };
}

/** Extract the numeric (quantity) fields from a calculation object. */
export function quantitiesFromCalculation(
  calculation: Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(calculation)) {
    if (typeof value === "number" && Number.isInteger(value)) out[key] = value;
  }
  return out;
}
