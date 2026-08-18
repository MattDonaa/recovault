import type {
  Balance,
  Offer,
  Return,
  Sale,
  SellerMetadata,
  Shipment,
  Transaction,
} from "@/core/marketplace/dto";
import type { MarketplaceMode } from "@/core/tenancy/schema";

import { TAKEALOT_CURRENCY } from "@/integrations/takealot/config";
import {
  multiplyMoney,
  randToMoney,
  subtractMoney,
} from "@/integrations/takealot/money";
import type {
  TakealotDisbursement,
  TakealotOffer,
  TakealotReturn,
  TakealotSale,
  TakealotSeller,
  TakealotShipment,
  TakealotTransaction,
} from "@/integrations/takealot/schemas";

/** Normalize any Takealot timestamp/date to a UTC ISO-8601 string. */
function toUtcIso(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid Takealot timestamp: ${value}`);
  }
  return d.toISOString();
}

export function mapOffer(o: TakealotOffer): Offer {
  const stock = o.seller_warehouse_stock ?? null;
  const stockOnHand = stock
    ? stock.reduce((sum, s) => sum + (s.quantity_available ?? 0), 0)
    : null;
  return {
    externalId: String(o.offer_id),
    sku: o.sku,
    title: o.title,
    price: randToMoney(o.selling_price),
    stockOnHand,
    status: o.status === "buyable" ? "active" : "inactive",
  };
}

export function mapSale(s: TakealotSale): Sale {
  const gross = multiplyMoney(randToMoney(s.selling_price), s.quantity);
  const fees =
    s.total_fees !== null && s.total_fees !== undefined
      ? randToMoney(s.total_fees)
      : null;
  const net = fees ? subtractMoney(gross, fees) : null;
  return {
    externalId: String(s.order_item_id),
    orderExternalId: String(s.order_id),
    sku: s.sku,
    quantity: s.quantity,
    soldAt: toUtcIso(s.order_date),
    gross,
    fees,
    net,
  };
}

/** Takealot ReturnOutcomeEnum → canonical return outcome (documented mapping). */
export function mapReturnOutcome(
  statuses: readonly string[],
): Return["outcome"] {
  if (statuses.includes("sellable_stock")) return "restocked";
  if (statuses.includes("removal_order")) return "returned_to_seller";
  return "pending";
}

export function mapReturn(r: TakealotReturn): Return {
  const statuses = (r.outcomes ?? []).map((o) => o.status);
  return {
    externalId: String(r.seller_return_id),
    orderExternalId: r.order_id !== null && r.order_id !== undefined ? String(r.order_id) : null,
    sku: r.sku,
    quantity: r.quantity,
    outcome: mapReturnOutcome(statuses),
    reason: r.return_reason ?? null,
    occurredAt: toUtcIso(r.return_date),
    refund: null,
  };
}

/** Takealot PurchaseOrderStateEnum → canonical shipment status. */
export function mapShipmentStatus(
  state: string | null | undefined,
  cancelled: boolean | null | undefined,
): Shipment["status"] {
  if (cancelled) return "resolved";
  switch (state) {
    case "received_full_quantity":
      return "received";
    case "partially_received":
      return "discrepancy";
    case "closed_partially_received":
      return "resolved";
    case "shipped":
    case "receiving":
    case "unloaded":
      return "pending";
    default:
      return "pending";
  }
}

/** One Takealot shipment expands to one canonical shipment record per item. */
export function mapShipment(sh: TakealotShipment): Shipment[] {
  const items = sh.shipment_items ?? [];
  const createdAtSource = sh.created_at ?? null;
  return items.map((item) => {
    if (item.offer_id === null || item.offer_id === undefined) {
      throw new Error(
        `Shipment item ${item.shipment_item_id} has no offer_id`,
      );
    }
    const createdAt = createdAtSource ?? item.created_at;
    if (!createdAt) {
      throw new Error(
        `Shipment ${sh.shipment_id} item ${item.shipment_item_id} has no created_at`,
      );
    }
    return {
      externalId: String(item.shipment_item_id),
      reference:
        sh.purchase_order_number !== null && sh.purchase_order_number !== undefined
          ? String(sh.purchase_order_number)
          : (sh.reference ?? null),
      sku: String(item.offer_id),
      quantitySent: item.quantity_sending ?? 0,
      quantityReceived: item.purchase_order_quantity_received ?? 0,
      quantityDamaged: item.purchase_order_quantity_damaged ?? 0,
      status: mapShipmentStatus(sh.purchase_order_state, sh.cancelled || item.cancelled),
      createdAt: toUtcIso(createdAt),
      updatedAt: null,
    };
  });
}

/**
 * Takealot TransactionTypeEnum → canonical transaction type. Special cases are
 * mapped explicitly; everything else falls back by verb prefix. Documented in
 * docs/TAKEALOT_API.md.
 */
export function mapTransactionType(raw: string): Transaction["type"] {
  switch (raw) {
    case "payment-customer-order":
      return "sale";
    case "reversal-customer-order":
      return "reversal";
    case "payment-stock-loss-payment":
    case "payment-return-dispute-payment":
      return "reimbursement";
  }
  if (raw.startsWith("reversal-")) return "reversal";
  if (raw.startsWith("charge-")) return "fee";
  // disbursement-*, payment-*, funding-* and anything else are ledger
  // adjustments from our recovery domain's perspective.
  return "adjustment";
}

function relatedRef(t: TakealotTransaction): string | null {
  const ref = (t.references ?? [])[0];
  if (!ref) return null;
  const candidate =
    ref.order_item_id ??
    ref.order_id ??
    ref.return_reference_number ??
    ref.purchase_order_number ??
    ref.removal_order_item_id ??
    null;
  return candidate !== null && candidate !== undefined ? String(candidate) : null;
}

export function mapTransaction(t: TakealotTransaction): Transaction {
  return {
    externalId: String(t.transaction_id),
    type: mapTransactionType(t.transaction_type),
    amount: randToMoney(t.amount_incl_vat),
    occurredAt: toUtcIso(t.created_at),
    relatedExternalId: relatedRef(t),
    description: t.transaction_type.slice(0, 500),
  };
}

export function mapBalances(d: TakealotDisbursement): Balance[] {
  const b = d.balances;
  return [
    {
      currency: TAKEALOT_CURRENCY,
      available: randToMoney(b.available ?? 0),
      pending: b.held_back !== null && b.held_back !== undefined ? randToMoney(b.held_back) : null,
      asOf: new Date().toISOString(),
    },
  ];
}

export function mapSeller(s: TakealotSeller): SellerMetadata {
  const country = (s.countries ?? [])[0];
  const countryCode = country && /^[A-Z]{2}$/.test(country) ? country : null;
  return {
    externalId: String(s.seller_id),
    displayName: s.display_name,
    defaultCurrency: TAKEALOT_CURRENCY,
    countryCode,
  };
}

export const TAKEALOT_MODE: MarketplaceMode = "live";
