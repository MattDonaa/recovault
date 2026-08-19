import {
  bandForScore,
  numRef,
  strRef,
  type DetectedCandidate,
  type LedgerEvent,
  type RecoveryRule,
} from "@/core/recovery/types";

/**
 * MR-001 — Inbound Shipment Discrepancy.
 *
 * unaccounted = quantity_sending - quantity_received - quantity_damaged
 *
 * Required evidence: a shipment_item event with all three quantity fields
 * present (never inferred as zero). Disqualifiers: the shipment is resolved, or
 * all units are accounted for (unaccounted <= 0). Confidence: HIGH (score 90)
 * when evidence is complete and there is a positive unaccounted quantity.
 * Monetary valuation formula: potential_recovery = unaccounted × unit_cost;
 * unit cost is not present in the ledger, so the amount is recorded as null
 * (quantity-based evidence) pending price linkage.
 */
const SCORE = 90;

export const mr001: RecoveryRule = {
  id: "MR-001",
  version: "MR-001:v1",
  evaluate(events: LedgerEvent[]): DetectedCandidate[] {
    const out: DetectedCandidate[] = [];
    for (const e of events) {
      if (e.eventType !== "shipment_item") continue;

      const sent = numRef(e.references, "quantitySent");
      const received = numRef(e.references, "quantityReceived");
      const damaged = numRef(e.references, "quantityDamaged");
      const status = strRef(e.references, "status");

      // Required evidence: quantities must be explicitly present.
      if (sent === null || received === null || damaged === null) continue;
      // Disqualifier: a resolved shipment discrepancy is already accounted for.
      if (status === "resolved") continue;

      const unaccounted = sent - received - damaged;
      if (unaccounted <= 0) continue; // all units accounted for

      out.push({
        ruleId: this.id,
        ruleVersion: this.version,
        candidateKey: `MR-001:${e.eventKey}`,
        confidence: bandForScore(SCORE),
        confidenceScore: SCORE,
        potentialRecoveryMinor: null,
        currency: null,
        sku: e.sku,
        externalRef: e.externalRef,
        title: `Unaccounted inbound units (${unaccounted})`,
        summary:
          `Inbound shipment ${e.externalRef} shows ${unaccounted} unaccounted unit(s): ` +
          `sent ${sent}, received ${received}, damaged ${damaged}. Recovery candidate — investigate.`,
        calculation: {
          quantitySent: sent,
          quantityReceived: received,
          quantityDamaged: damaged,
          unaccounted,
          formula: "unaccounted = quantitySent - quantityReceived - quantityDamaged",
        },
        evidence: [{ eventId: e.id, eventKey: e.eventKey, role: "shipment" }],
      });
    }
    return out;
  },
};
