import { describe, expect, it } from "vitest";

import type { EventType } from "@/core/ledger/types";
import { mr001 } from "@/core/recovery/rules/mr001";
import { mr002 } from "@/core/recovery/rules/mr002";
import { mr003 } from "@/core/recovery/rules/mr003";
import type { LedgerEvent } from "@/core/recovery/types";

function ev(o: Partial<LedgerEvent> & { eventType: EventType }): LedgerEvent {
  return {
    id: o.id ?? o.eventKey ?? "e",
    eventType: o.eventType,
    externalRef: o.externalRef ?? "x",
    sku: o.sku ?? null,
    orderExternalId: o.orderExternalId ?? null,
    references: o.references ?? {},
    quantity: o.quantity ?? null,
    amountMinor: o.amountMinor ?? null,
    currency: o.currency ?? null,
    occurredAt: o.occurredAt ?? null,
    eventKey: o.eventKey ?? "k",
    sourceRecordId: o.sourceRecordId ?? "src",
  };
}

function shipment(refs: Record<string, unknown>, externalRef = "shp-1"): LedgerEvent {
  return ev({
    eventType: "shipment_item",
    externalRef,
    eventKey: `shipment_item:${externalRef}`,
    sku: "SKU-A",
    references: refs,
  });
}

describe("MR-001 — inbound shipment discrepancy", () => {
  it("positive: raises a candidate with the exact unaccounted quantity", () => {
    const [c] = mr001.evaluate([
      shipment({ quantitySent: 50, quantityReceived: 44, quantityDamaged: 0, status: "discrepancy" }),
    ]);
    expect(c).toMatchObject({
      ruleId: "MR-001",
      ruleVersion: "MR-001:v1",
      candidateKey: "MR-001:shipment_item:shp-1",
      confidence: "HIGH",
      confidenceScore: 90,
      potentialRecoveryMinor: null,
    });
    expect(c!.calculation).toMatchObject({ unaccounted: 6 });
  });

  it("healthy negative: no candidate when fully received", () => {
    expect(
      mr001.evaluate([shipment({ quantitySent: 50, quantityReceived: 50, quantityDamaged: 0, status: "received" })]),
    ).toEqual([]);
  });

  it("boundary: unaccounted exactly 0 → none; exactly 1 → candidate", () => {
    expect(
      mr001.evaluate([shipment({ quantitySent: 50, quantityReceived: 45, quantityDamaged: 5, status: "discrepancy" })]),
    ).toEqual([]);
    expect(
      mr001.evaluate([shipment({ quantitySent: 50, quantityReceived: 49, quantityDamaged: 0, status: "discrepancy" })]),
    ).toHaveLength(1);
  });

  it("resolved shipments are disqualified", () => {
    expect(
      mr001.evaluate([shipment({ quantitySent: 50, quantityReceived: 44, quantityDamaged: 0, status: "resolved" })]),
    ).toEqual([]);
  });

  it("missing evidence: a quantity field absent → no candidate", () => {
    expect(
      mr001.evaluate([shipment({ quantitySent: 50, quantityDamaged: 0, status: "discrepancy" })]),
    ).toEqual([]);
  });

  it("duplicate execution is deterministic", () => {
    const input = [shipment({ quantitySent: 50, quantityReceived: 44, quantityDamaged: 0, status: "discrepancy" })];
    expect(mr001.evaluate(input)).toEqual(mr001.evaluate(input));
  });
});

const refundReturn = (amount: number | null = -19900) =>
  ev({
    eventType: "return",
    externalRef: "ret-1",
    eventKey: "return:ret-1",
    sku: "SKU-A",
    amountMinor: amount,
    currency: "ZAR",
    references: { outcome: "refunded" },
  });

const refundCharge = (related = "ret-1") =>
  ev({
    eventType: "charge",
    externalRef: "txn-9",
    eventKey: "transaction:txn-9",
    references: { canonicalType: "refund", relatedExternalId: related },
  });

describe("MR-002 — return financial/outcome mismatch", () => {
  it("positive: refunded outcome without a matching refund → MEDIUM candidate", () => {
    const [c] = mr002.evaluate([refundReturn()]);
    expect(c).toMatchObject({
      ruleId: "MR-002",
      ruleVersion: "MR-002:v1",
      confidence: "MEDIUM",
      confidenceScore: 60,
      potentialRecoveryMinor: 19900,
      currency: "ZAR",
    });
  });

  it("negative: a matching refund transaction clears it", () => {
    expect(mr002.evaluate([refundReturn(), refundCharge("ret-1")])).toEqual([]);
  });

  it("only the refunded predicate triggers (restocked is ignored)", () => {
    const restock = ev({
      eventType: "return",
      externalRef: "ret-2",
      eventKey: "return:ret-2",
      references: { outcome: "restocked" },
    });
    expect(mr002.evaluate([restock])).toEqual([]);
  });

  it("duplicate execution is deterministic", () => {
    const input = [refundReturn()];
    expect(mr002.evaluate(input)).toEqual(mr002.evaluate(input));
  });
});

const lossShipment = () => shipment({ quantitySent: 50, quantityReceived: 45, quantityDamaged: 5, status: "discrepancy" });
const reimbursement = (external = "txn-1", related = "shp-1", amount = 99500) =>
  ev({
    eventType: "payment",
    externalRef: external,
    eventKey: `transaction:${external}`,
    amountMinor: amount,
    currency: "ZAR",
    references: { canonicalType: "reimbursement", relatedExternalId: related },
  });
const reversalOf = (paymentExternal = "txn-1") =>
  ev({
    eventType: "reversal",
    externalRef: "txn-2",
    eventKey: "transaction:txn-2",
    references: { canonicalType: "reversal", relatedExternalId: paymentExternal },
  });

describe("MR-003 — stock loss without matching recovery", () => {
  it("positive unpaid: verified loss, no reimbursement → HIGH candidate", () => {
    const [c] = mr003.evaluate([lossShipment()]);
    expect(c).toMatchObject({
      ruleId: "MR-003",
      ruleVersion: "MR-003:v1",
      confidence: "HIGH",
      confidenceScore: 90,
      potentialRecoveryMinor: null,
    });
    expect(c!.calculation).toMatchObject({ quantityDamaged: 5, reimbursementFound: false });
  });

  it("positive reversed: reimbursement reversed → HIGH candidate with the reversed amount", () => {
    const [c] = mr003.evaluate([lossShipment(), reimbursement(), reversalOf()]);
    expect(c).toMatchObject({ confidenceScore: 88, potentialRecoveryMinor: 99500 });
    expect(c!.evidence.map((e) => e.role)).toEqual(["loss", "reversed_payment", "reversal"]);
  });

  it("negative paid: a valid unreversed reimbursement clears it", () => {
    expect(mr003.evaluate([lossShipment(), reimbursement()])).toEqual([]);
  });

  it("no loss (0 damaged) → no candidate", () => {
    expect(
      mr003.evaluate([shipment({ quantitySent: 50, quantityReceived: 50, quantityDamaged: 0, status: "received" })]),
    ).toEqual([]);
  });

  it("missing evidence: no quantityDamaged field → no candidate", () => {
    expect(mr003.evaluate([shipment({ quantitySent: 50, quantityReceived: 45, status: "discrepancy" })])).toEqual([]);
  });

  it("duplicate execution is deterministic", () => {
    const input = [lossShipment(), reimbursement(), reversalOf()];
    expect(mr003.evaluate(input)).toEqual(mr003.evaluate(input));
  });
});
