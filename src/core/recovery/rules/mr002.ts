import {
  bandForScore,
  strRef,
  type DetectedCandidate,
  type LedgerEvent,
  type RecoveryRule,
} from "@/core/recovery/types";

/**
 * MR-002 — Return Financial / Outcome Mismatch.
 *
 * Permitted predicate (the only one tested/enabled): a return whose outcome is
 * "refunded" but for which NO matching refund transaction exists (a `charge`
 * event with canonicalType "refund" whose relatedExternalId equals the return's
 * external ref). This is an explicit contradiction between the return outcome
 * and the linked financial events.
 *
 * Required evidence: a return event with a concrete outcome. Disqualifier: a
 * matching refund exists. Confidence: capped at MEDIUM (score 60) — the
 * contradiction is real but its resolution is ambiguous, so it can never be
 * HIGH. Not generalized beyond this predicate.
 */
const SCORE = 60;

export const mr002: RecoveryRule = {
  id: "MR-002",
  version: "MR-002:v1",
  evaluate(events: LedgerEvent[]): DetectedCandidate[] {
    const refundEvents = events.filter(
      (e) => e.eventType === "charge" && strRef(e.references, "canonicalType") === "refund",
    );
    const out: DetectedCandidate[] = [];

    for (const e of events) {
      if (e.eventType !== "return") continue;
      const outcome = strRef(e.references, "outcome");
      if (outcome !== "refunded") continue; // only the tested predicate

      const hasMatchingRefund = refundEvents.some(
        (r) => strRef(r.references, "relatedExternalId") === e.externalRef,
      );
      if (hasMatchingRefund) continue; // consistent — no anomaly

      const expected = e.amountMinor !== null ? Math.abs(e.amountMinor) : null;
      out.push({
        ruleId: this.id,
        ruleVersion: this.version,
        candidateKey: `MR-002:${e.eventKey}`,
        confidence: bandForScore(SCORE),
        confidenceScore: SCORE,
        potentialRecoveryMinor: expected,
        currency: e.currency,
        sku: e.sku,
        externalRef: e.externalRef,
        title: "Return marked refunded without a matching refund",
        summary:
          `Return ${e.externalRef} has outcome "refunded" but no matching refund ` +
          `transaction was found. Anomaly — needs investigation.`,
        calculation: {
          outcome,
          matchingRefundFound: false,
          expectedRefundMinor: expected,
        },
        evidence: [{ eventId: e.id, eventKey: e.eventKey, role: "return" }],
      });
    }
    return out;
  },
};
