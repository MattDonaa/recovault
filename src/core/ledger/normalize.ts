import {
  returnSchema,
  saleSchema,
  shipmentSchema,
  transactionSchema,
  type Transaction,
} from "@/core/marketplace/dto";
import type { EventType, NormalizedEvent, SourceRecordRow } from "@/core/ledger/types";

export const NORMALIZER_VERSION = "ledger:v1";

/**
 * Map a canonical transaction type to a canonical ledger event type. This is the
 * source-enum → canonical-event-type mapping (money direction expressed by the
 * event type; the exact source type is retained in references).
 */
export function transactionTypeToEvent(type: Transaction["type"]): EventType {
  switch (type) {
    case "sale":
    case "reimbursement":
      return "payment";
    case "fee":
    case "refund":
      return "charge";
    case "reversal":
      return "reversal";
    case "adjustment":
      return "adjustment";
  }
}

/**
 * Deterministically normalize one source record into zero or more ledger
 * events. Only the MVP families produce events; offers/balances produce none.
 * The same source record always yields the same events (including event key).
 */
export function normalizeSourceRecord(row: SourceRecordRow): NormalizedEvent[] {
  switch (row.externalType) {
    case "sales": {
      const s = saleSchema.parse(row.payload);
      return [
        {
          eventType: "sale",
          externalRef: s.externalId,
          sku: s.sku,
          orderExternalId: s.orderExternalId,
          references: { fees: s.fees, net: s.net },
          quantity: s.quantity,
          amountMinor: s.gross.minorUnits,
          currency: s.gross.currency,
          occurredAt: s.soldAt,
          eventKey: `sale:${s.externalId}`,
        },
      ];
    }
    case "shipments": {
      const sh = shipmentSchema.parse(row.payload);
      return [
        {
          eventType: "shipment_item",
          externalRef: sh.externalId,
          sku: sh.sku,
          orderExternalId: null,
          references: {
            quantitySent: sh.quantitySent,
            quantityReceived: sh.quantityReceived,
            quantityDamaged: sh.quantityDamaged,
            status: sh.status,
            reference: sh.reference,
          },
          quantity: sh.quantitySent,
          amountMinor: null,
          currency: null,
          occurredAt: sh.createdAt,
          eventKey: `shipment_item:${sh.externalId}`,
        },
      ];
    }
    case "returns": {
      const r = returnSchema.parse(row.payload);
      return [
        {
          eventType: "return",
          externalRef: r.externalId,
          sku: r.sku,
          orderExternalId: r.orderExternalId,
          references: { outcome: r.outcome, reason: r.reason },
          quantity: r.quantity,
          amountMinor: r.refund?.minorUnits ?? null,
          currency: r.refund?.currency ?? null,
          occurredAt: r.occurredAt,
          eventKey: `return:${r.externalId}`,
        },
      ];
    }
    case "transactions": {
      const t = transactionSchema.parse(row.payload);
      return [
        {
          eventType: transactionTypeToEvent(t.type),
          externalRef: t.externalId,
          sku: null,
          orderExternalId: null,
          references: {
            canonicalType: t.type,
            relatedExternalId: t.relatedExternalId,
            description: t.description,
          },
          quantity: null,
          amountMinor: t.amount.minorUnits,
          currency: t.amount.currency,
          occurredAt: t.occurredAt,
          eventKey: `transaction:${t.externalId}`,
        },
      ];
    }
    default:
      // offers, balances, and anything else are not ledger events.
      return [];
  }
}
