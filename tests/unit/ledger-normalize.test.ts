import { describe, expect, it } from "vitest";

import {
  normalizeSourceRecord,
  transactionTypeToEvent,
} from "@/core/ledger/normalize";
import type { NormalizedEvent, SourceRecordRow } from "@/core/ledger/types";

function row(externalType: string, externalId: string, payload: unknown): SourceRecordRow {
  return {
    id: "src-1",
    organizationId: "org-1",
    marketplaceAccountId: "acc-1",
    marketplace: "mock",
    externalType,
    externalId,
    sourceTimestamp: null,
    payload,
  };
}

const sale = {
  externalId: "7778888",
  orderExternalId: "5551111",
  sku: "SKU-A",
  quantity: 3,
  soldAt: "2026-01-15T12:30:00.000Z",
  gross: { minorUnits: 103500, currency: "ZAR" },
  fees: { minorUnits: 1575, currency: "ZAR" },
  net: { minorUnits: 101925, currency: "ZAR" },
};

describe("ledger normalize", () => {
  it("maps canonical transaction types to canonical event types", () => {
    expect(transactionTypeToEvent("sale")).toBe("payment");
    expect(transactionTypeToEvent("reimbursement")).toBe("payment");
    expect(transactionTypeToEvent("fee")).toBe("charge");
    expect(transactionTypeToEvent("refund")).toBe("charge");
    expect(transactionTypeToEvent("reversal")).toBe("reversal");
    expect(transactionTypeToEvent("adjustment")).toBe("adjustment");
  });

  it("normalizes a sale with an exact monetary amount (minor units)", () => {
    const [event] = normalizeSourceRecord(row("sales", sale.externalId, sale));
    expect(event).toMatchObject<Partial<NormalizedEvent>>({
      eventType: "sale",
      externalRef: "7778888",
      sku: "SKU-A",
      orderExternalId: "5551111",
      quantity: 3,
      amountMinor: 103500,
      currency: "ZAR",
      occurredAt: "2026-01-15T12:30:00.000Z",
      eventKey: "sale:7778888",
    });
    // Exactness: integer minor units, never float.
    expect(Number.isInteger(event!.amountMinor)).toBe(true);
  });

  it("is deterministic: same source → same event key and fields", () => {
    const a = normalizeSourceRecord(row("sales", sale.externalId, sale));
    const b = normalizeSourceRecord(row("sales", sale.externalId, sale));
    expect(a).toEqual(b);
    expect(a[0]!.eventKey).toBe("sale:7778888");
  });

  it("normalizes a shipment item preserving quantities", () => {
    const shipment = {
      externalId: "500002",
      reference: "PO-30012",
      sku: "987655",
      quantitySent: 20,
      quantityReceived: 15,
      quantityDamaged: 5,
      status: "discrepancy",
      createdAt: "2026-01-10T04:00:00.000Z",
      updatedAt: null,
    };
    const [event] = normalizeSourceRecord(row("shipments", shipment.externalId, shipment));
    expect(event).toMatchObject({
      eventType: "shipment_item",
      quantity: 20,
      eventKey: "shipment_item:500002",
    });
    expect(event!.references).toMatchObject({
      quantitySent: 20,
      quantityReceived: 15,
      quantityDamaged: 5,
      status: "discrepancy",
    });
  });

  it("normalizes a stock-loss reimbursement transaction to a payment event", () => {
    const txn = {
      externalId: "42001",
      type: "reimbursement",
      amount: { minorUnits: 11500, currency: "ZAR" },
      occurredAt: "2026-01-20T06:00:00.000Z",
      relatedExternalId: "30012",
      description: "payment-stock-loss-payment",
    };
    const [event] = normalizeSourceRecord(row("transactions", txn.externalId, txn));
    expect(event).toMatchObject({
      eventType: "payment",
      amountMinor: 11500,
      eventKey: "transaction:42001",
    });
    expect(event!.references).toMatchObject({ canonicalType: "reimbursement" });
  });

  it("produces no events for non-ledger source types", () => {
    expect(normalizeSourceRecord(row("offers", "off-1", {}))).toEqual([]);
    expect(normalizeSourceRecord(row("balances", "ZAR", {}))).toEqual([]);
  });
});
