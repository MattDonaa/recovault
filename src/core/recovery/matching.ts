import type { CaseStatus } from "@/core/cases/status";
import { strRef, type LedgerEvent } from "@/core/recovery/types";

/**
 * Deterministic recovery matching. A recovery/payment event is matched to a
 * case by canonical identifier (the payment's relatedExternalId equals the
 * case's loss reference). Rules:
 *   - exactly one open case, payment not reversed → matched
 *   - the matched payment was reversed → reversed (NOT a valid recovery)
 *   - more than one open case matches → needs_review (never silently closed)
 *   - no open case matches → unmatched
 */
export type MatchDecision =
  | { kind: "matched"; caseId: string }
  | { kind: "reversed"; caseId: string | null }
  | { kind: "needs_review"; caseIds: string[] }
  | { kind: "unmatched" };

export interface OpenCaseRef {
  caseId: string;
  lossRef: string;
  status: CaseStatus;
}

export interface RecoveryPayment {
  eventId: string;
  externalRef: string;
  relatedExternalId: string | null;
  amountMinor: number | null;
  currency: string | null;
}

/** A recovery/payment event = a `payment` event that is a reimbursement. */
export function isRecoveryPayment(event: LedgerEvent): boolean {
  return (
    event.eventType === "payment" &&
    strRef(event.references, "canonicalType") === "reimbursement"
  );
}

export function toRecoveryPayment(event: LedgerEvent): RecoveryPayment {
  return {
    eventId: event.id,
    externalRef: event.externalRef,
    relatedExternalId: strRef(event.references, "relatedExternalId"),
    amountMinor: event.amountMinor,
    currency: event.currency,
  };
}

/** Set of payment external refs that a reversal event points at. */
export function reversedPaymentRefs(events: LedgerEvent[]): Set<string> {
  const set = new Set<string>();
  for (const e of events) {
    if (e.eventType !== "reversal") continue;
    const ref = strRef(e.references, "relatedExternalId");
    if (ref) set.add(ref);
  }
  return set;
}

export function decideMatch(
  payment: RecoveryPayment,
  reversed: Set<string>,
  openCases: OpenCaseRef[],
): MatchDecision {
  const matching = payment.relatedExternalId
    ? openCases.filter((c) => c.lossRef === payment.relatedExternalId)
    : [];

  if (matching.length === 0) return { kind: "unmatched" };
  if (matching.length > 1) {
    return { kind: "needs_review", caseIds: matching.map((c) => c.caseId) };
  }

  const only = matching[0]!;
  if (reversed.has(payment.externalRef)) {
    return { kind: "reversed", caseId: only.caseId };
  }
  return { kind: "matched", caseId: only.caseId };
}
