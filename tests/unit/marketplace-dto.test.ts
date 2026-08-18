import { describe, expect, it } from "vitest";

import {
  moneySchema,
  offerSchema,
  saleSchema,
  shipmentSchema,
} from "@/core/marketplace/dto";

describe("marketplace DTOs", () => {
  it("requires money as integer minor units + ISO currency", () => {
    expect(moneySchema.parse({ minorUnits: 19900, currency: "ZAR" })).toEqual({
      minorUnits: 19900,
      currency: "ZAR",
    });
    expect(() => moneySchema.parse({ minorUnits: 1.5, currency: "ZAR" })).toThrow();
    expect(() => moneySchema.parse({ minorUnits: 100, currency: "zar" })).toThrow();
    expect(() => moneySchema.parse({ minorUnits: 100, currency: "Rand" })).toThrow();
  });

  it("applies documented defaults on optional fields", () => {
    const offer = offerSchema.parse({
      externalId: "off-1",
      sku: "SKU-A",
      title: "Demo",
      price: { minorUnits: 100, currency: "ZAR" },
    });
    expect(offer.stockOnHand).toBeNull();
    expect(offer.status).toBe("active");
  });

  it("fails closed on invalid sale payloads", () => {
    const good = {
      externalId: "sale-1",
      orderExternalId: "order-1",
      sku: "SKU-A",
      quantity: 1,
      soldAt: "2026-01-02T12:00:00.000Z",
      gross: { minorUnits: 19900, currency: "ZAR" },
    };
    expect(saleSchema.safeParse(good).success).toBe(true);
    expect(saleSchema.safeParse({ ...good, quantity: 0 }).success).toBe(false);
    expect(saleSchema.safeParse({ ...good, soldAt: "nope" }).success).toBe(false);
  });

  it("rejects negative shipment quantities", () => {
    const base = {
      externalId: "shp-1",
      sku: "SKU-A",
      quantitySent: 10,
      quantityReceived: 10,
      status: "received",
      createdAt: "2026-01-01T12:00:00.000Z",
    };
    expect(shipmentSchema.safeParse(base).success).toBe(true);
    expect(
      shipmentSchema.safeParse({ ...base, quantitySent: -1 }).success,
    ).toBe(false);
  });
});
