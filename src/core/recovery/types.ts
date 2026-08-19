import type { EventType } from "@/core/ledger/types";

/**
 * Deterministic, rule-based recovery detection over the canonical ledger. No
 * LLM determines liability, anomaly existence, amount, confidence, or
 * eligibility. Every candidate is explainable from its linked ledger events.
 */
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** A canonical ledger event as consumed by the rules (read from the DB). */
export interface LedgerEvent {
  id: string;
  eventType: EventType;
  externalRef: string;
  sku: string | null;
  orderExternalId: string | null;
  references: Record<string, unknown>;
  quantity: number | null;
  amountMinor: number | null;
  currency: string | null;
  occurredAt: string | null;
  eventKey: string;
  sourceRecordId: string;
}

export interface EvidenceLink {
  eventId: string;
  eventKey: string;
  role: string;
}

export interface DetectedCandidate {
  ruleId: string;
  ruleVersion: string;
  candidateKey: string;
  confidence: Confidence;
  confidenceScore: number;
  potentialRecoveryMinor: number | null;
  currency: string | null;
  sku: string | null;
  externalRef: string | null;
  title: string;
  summary: string;
  calculation: Record<string, unknown>;
  evidence: EvidenceLink[];
}

export interface RecoveryRule {
  readonly id: string;
  readonly version: string;
  evaluate(events: LedgerEvent[]): DetectedCandidate[];
}

export interface RecoveryContext {
  organizationId: string;
  marketplaceAccountId: string;
}

export interface RecoveryStore {
  listEvents(accountId: string): Promise<LedgerEvent[]>;
  upsertCandidate(input: {
    context: RecoveryContext;
    candidate: DetectedCandidate;
  }): Promise<{ id: string | null; result: "inserted" | "unchanged" }>;
  linkEvidence(input: {
    organizationId: string;
    candidateId: string;
    eventId: string;
    role: string;
  }): Promise<void>;
  deleteCandidates(accountId: string): Promise<void>;
}

export interface RecoveryResult {
  candidatesDetected: number;
  candidatesInserted: number;
  candidatesUnchanged: number;
}

/** Confidence band from a deterministic score. */
export function bandForScore(score: number): Confidence {
  if (score >= 80) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

/** Safe readers for jsonb reference values. */
export function numRef(refs: Record<string, unknown>, key: string): number | null {
  const v = refs[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
export function strRef(refs: Record<string, unknown>, key: string): string | null {
  const v = refs[key];
  return typeof v === "string" ? v : null;
}
