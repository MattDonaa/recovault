import {
  bandForScore,
  numRef,
  strRef,
  type DetectedCandidate,
  type EvidenceLink,
  type LedgerEvent,
  type RecoveryRule,
} from "@/core/recovery/types";

/**
 * MR-003 — Stock-Loss Event Without Matching Recovery.
 *
 * Verified loss reference: a shipment_item event with quantity_damaged > 0.
 * Matching recovery: a `payment` event whose relatedExternalId equals the loss
 * shipment's external ref. A reversal is handled explicitly — a payment that
 * was later reversed (a `reversal` event whose relatedExternalId equals the
 * payment's external ref) is NOT a valid recovery.
 *
 * Candidate when there is a verified loss and no valid (unreversed) matching
 * recovery. Disqualifier: a valid unreversed matching payment exists.
 * Confidence: HIGH (90 when never reimbursed; 88 when a reimbursement was
 * reversed). Potential recovery: the reversed reimbursement amount when known,
 * otherwise null (quantity-based).
 */
const SCORE_UNPAID = 90;
const SCORE_REVERSED = 88;

export const mr003: RecoveryRule = {
  id: "MR-003",
  version: "MR-003:v1",
  evaluate(events: LedgerEvent[]): DetectedCandidate[] {
    const payments = events.filter((e) => e.eventType === "payment");
    const reversals = events.filter((e) => e.eventType === "reversal");
    const out: DetectedCandidate[] = [];

    for (const e of events) {
      if (e.eventType !== "shipment_item") continue;
      const damaged = numRef(e.references, "quantityDamaged");
      if (damaged === null || damaged <= 0) continue; // require a verified loss

      const lossRef = e.externalRef;
      const matching = payments.filter(
        (p) => strRef(p.references, "relatedExternalId") === lossRef,
      );
      const isReversed = (p: LedgerEvent) =>
        reversals.some((rv) => strRef(rv.references, "relatedExternalId") === p.externalRef);

      const validPayment = matching.find((p) => !isReversed(p));
      if (validPayment) continue; // a valid recovery already exists

      const reversedPayment = matching[0] ?? null;
      const potential =
        reversedPayment && reversedPayment.amountMinor !== null
          ? Math.abs(reversedPayment.amountMinor)
          : null;
      const score = reversedPayment ? SCORE_REVERSED : SCORE_UNPAID;

      const evidence: EvidenceLink[] = [
        { eventId: e.id, eventKey: e.eventKey, role: "loss" },
      ];
      if (reversedPayment) {
        evidence.push({
          eventId: reversedPayment.id,
          eventKey: reversedPayment.eventKey,
          role: "reversed_payment",
        });
        const rv = reversals.find(
          (r) => strRef(r.references, "relatedExternalId") === reversedPayment.externalRef,
        );
        if (rv) evidence.push({ eventId: rv.id, eventKey: rv.eventKey, role: "reversal" });
      }

      out.push({
        ruleId: this.id,
        ruleVersion: this.version,
        candidateKey: `MR-003:${e.eventKey}`,
        confidence: bandForScore(score),
        confidenceScore: score,
        potentialRecoveryMinor: potential,
        currency: reversedPayment?.currency ?? null,
        sku: e.sku,
        externalRef: lossRef,
        title: `Stock loss without matching recovery (${damaged} unit(s))`,
        summary: reversedPayment
          ? `Stock loss of ${damaged} unit(s) on ${lossRef} had a reimbursement that was ` +
            `reversed, leaving it unrecovered. Recovery candidate.`
          : `Stock loss of ${damaged} unit(s) on ${lossRef} has no matching reimbursement. ` +
            `Recovery candidate.`,
        calculation: {
          quantityDamaged: damaged,
          lossRef,
          reimbursementFound: matching.length > 0,
          reimbursementReversed: Boolean(reversedPayment),
          potentialRecoveryMinor: potential,
        },
        evidence,
      });
    }
    return out;
  },
};
