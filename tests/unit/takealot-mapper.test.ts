import { describe, expect, it } from "vitest";

import {
  offerSchema,
  returnSchema,
  saleSchema,
  shipmentSchema,
  transactionSchema,
} from "@/core/marketplace/dto";
import {
  mapBalances,
  mapOffer,
  mapReturn,
  mapSale,
  mapSeller,
  mapShipment,
  mapTransaction,
  mapTransactionType,
} from "@/integrations/takealot/mapper";
import {
  takealotDisbursementSchema,
  takealotOfferSchema,
  takealotReturnSchema,
  takealotSaleSchema,
  takealotSellerSchema,
  takealotShipmentSchema,
  takealotTransactionSchema,
} from "@/integrations/takealot/schemas";
import {
  disbursementPayload,
  feeTransactionPayload,
  offerPayload,
  returnPayload,
  salePayload,
  sellerPayload,
  shipmentPayload,
  stockLossTransactionPayload,
} from "../fixtures/takealot-payloads";

describe("takealot mapper", () => {
  it("maps an offer to a canonical, schema-valid offer", () => {
    const offer = mapOffer(takealotOfferSchema.parse(offerPayload));
    expect(offerSchema.safeParse(offer).success).toBe(true);
    expect(offer).toMatchObject({
      externalId: "987654",
      sku: "SKU-A",
      price: { minorUnits: 34500, currency: "ZAR" },
      stockOnHand: 100,
      status: "active",
    });
  });

  it("maps a sale with gross/fees/net in minor units", () => {
    const sale = mapSale(takealotSaleSchema.parse(salePayload));
    expect(saleSchema.safeParse(sale).success).toBe(true);
    expect(sale.gross).toEqual({ minorUnits: 103500, currency: "ZAR" }); // 345*100*3
    expect(sale.fees).toEqual({ minorUnits: 1575, currency: "ZAR" });
    expect(sale.net).toEqual({ minorUnits: 101925, currency: "ZAR" });
    expect(sale.soldAt).toBe("2026-01-15T12:30:00.000Z"); // +02:00 → UTC
  });

  it("expands a shipment into one canonical record per item with quantities", () => {
    const records = mapShipment(takealotShipmentSchema.parse(shipmentPayload));
    expect(records).toHaveLength(2);
    for (const r of records) expect(shipmentSchema.safeParse(r).success).toBe(true);
    expect(records[0]).toMatchObject({
      externalId: "500001",
      sku: "987654",
      quantitySent: 50,
      quantityReceived: 44,
      quantityDamaged: 0,
      status: "discrepancy",
    });
    expect(records[1]).toMatchObject({ quantityDamaged: 5, sku: "987655" });
  });

  it("maps a return outcome deterministically", () => {
    const ret = mapReturn(takealotReturnSchema.parse(returnPayload));
    expect(returnSchema.safeParse(ret).success).toBe(true);
    expect(ret.outcome).toBe("restocked"); // sellable_stock
    expect(ret.occurredAt).toBe("2026-01-25T00:00:00.000Z");
  });

  it("maps the verified transaction-type enum", () => {
    expect(mapTransactionType("payment-customer-order")).toBe("sale");
    expect(mapTransactionType("payment-stock-loss-payment")).toBe("reimbursement");
    expect(mapTransactionType("reversal-stock-loss-reversal")).toBe("reversal");
    expect(mapTransactionType("charge-success-fee")).toBe("fee");
    expect(mapTransactionType("disbursement-disbursement")).toBe("adjustment");
    expect(mapTransactionType("funding-repayment-funding-repayment-seller-capital")).toBe("adjustment");
  });

  it("maps a stock-loss transaction with a related reference", () => {
    const tx = mapTransaction(takealotTransactionSchema.parse(stockLossTransactionPayload));
    expect(transactionSchema.safeParse(tx).success).toBe(true);
    expect(tx).toMatchObject({
      externalId: "42001",
      type: "reimbursement",
      amount: { minorUnits: 11500, currency: "ZAR" },
      relatedExternalId: "30012",
    });
    const fee = mapTransaction(takealotTransactionSchema.parse(feeTransactionPayload));
    expect(fee.type).toBe("fee");
    expect(fee.relatedExternalId).toBe("7778888"); // order_item_id preferred
  });

  it("maps balances and seller metadata", () => {
    const balances = mapBalances(takealotDisbursementSchema.parse(disbursementPayload));
    expect(balances[0]).toMatchObject({
      currency: "ZAR",
      available: { minorUnits: 1250000, currency: "ZAR" },
      pending: { minorUnits: 250050, currency: "ZAR" },
    });
    const seller = mapSeller(takealotSellerSchema.parse(sellerPayload));
    expect(seller).toMatchObject({
      externalId: "123456",
      displayName: "Demo Seller",
      defaultCurrency: "ZAR",
      countryCode: "ZA",
    });
  });

  it("is deterministic across repeated maps", () => {
    const a = mapSale(takealotSaleSchema.parse(salePayload));
    const b = mapSale(takealotSaleSchema.parse(salePayload));
    expect(a).toEqual(b);
  });
});
