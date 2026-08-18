import { describe, expect, it } from "vitest";

import { validateRecord } from "@/core/marketplace/validation";
import {
  takealotEnvelopeSchema,
  takealotOfferSchema,
  takealotReturnSchema,
  takealotSaleSchema,
  takealotShipmentSchema,
  takealotTransactionSchema,
} from "@/integrations/takealot/schemas";
import {
  envelope,
  offerPayload,
  returnPayload,
  salePayload,
  shipmentPayload,
  stockLossTransactionPayload,
} from "../fixtures/takealot-payloads";

describe("takealot schemas", () => {
  it("validates official-shaped payloads", () => {
    expect(validateRecord(takealotOfferSchema, offerPayload).ok).toBe(true);
    expect(validateRecord(takealotSaleSchema, salePayload).ok).toBe(true);
    expect(validateRecord(takealotTransactionSchema, stockLossTransactionPayload).ok).toBe(true);
    expect(validateRecord(takealotShipmentSchema, shipmentPayload).ok).toBe(true);
    expect(validateRecord(takealotReturnSchema, returnPayload).ok).toBe(true);
  });

  it("tolerates unknown/additive fields", () => {
    const withExtra = { ...offerPayload, some_new_field: "future" };
    expect(validateRecord(takealotOfferSchema, withExtra).ok).toBe(true);
  });

  it("fails closed on malformed payloads (wrong types / missing keys)", () => {
    expect(validateRecord(takealotSaleSchema, { ...salePayload, quantity: "three" }).ok).toBe(false);
    expect(validateRecord(takealotOfferSchema, { offer_id: 1 }).ok).toBe(false); // missing sku/title/price
    expect(validateRecord(takealotTransactionSchema, { ...stockLossTransactionPayload, amount_incl_vat: "x" }).ok).toBe(false);
  });

  it("parses the list envelope with items and continuation token", () => {
    const parsed = takealotEnvelopeSchema.parse(envelope([offerPayload], "next-token"));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.continuation_token).toBe("next-token");
  });

  it("normalizes a missing continuation token to null", () => {
    const parsed = takealotEnvelopeSchema.parse({ items: [] });
    expect(parsed.continuation_token).toBeNull();
  });
});
