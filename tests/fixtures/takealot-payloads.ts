/**
 * Synthetic Takealot API payloads shaped after the verified official OpenAPI
 * spec (docs/TAKEALOT_API.md). No real seller data or secrets.
 */
export const sellerPayload = {
  seller_id: 123456,
  uuid: "00000000-0000-0000-0000-000000000000",
  display_name: "Demo Seller",
  legal_name: "Demo Seller (Pty) Ltd",
  countries: ["ZA"],
  account_verified: true,
  is_vat_registered: true,
};

export const offerPayload = {
  offer_id: 987654,
  sku: "SKU-A",
  barcode: "6001234567890",
  title: "Demo Product A",
  selling_price: 345,
  rrp: 399,
  status: "buyable",
  seller_warehouse_stock: [
    { seller_warehouse_id: 1, quantity_available: 40 },
    { seller_warehouse_id: 2, quantity_available: 60 },
  ],
};

export const salePayload = {
  order_id: 5551111,
  order_item_id: 7778888,
  offer_id: 987654,
  sku: "SKU-A",
  tsin_id: 111,
  quantity: 3,
  order_date: "2026-01-15T14:30:00+02:00",
  selling_price: 345,
  total_fees: 15.75,
  sale_status: "shipped_to_customer",
  sales_region: "jhb",
  stock_source_region: "jhb",
};

export const stockLossTransactionPayload = {
  transaction_id: 42001,
  transaction_type: "payment-stock-loss-payment",
  amount_incl_vat: 115,
  vat_multiplier: 0.15,
  created_at: "2026-01-20T08:00:00+02:00",
  references: [
    { purchase_order_number: 30012, item_quantity: 5, rule: "stock_loss" },
  ],
};

export const feeTransactionPayload = {
  transaction_id: 42002,
  transaction_type: "charge-success-fee",
  amount_incl_vat: 51.75,
  created_at: "2026-01-21T09:00:00+02:00",
  references: [{ order_id: 5551111, order_item_id: 7778888 }],
};

export const shipmentPayload = {
  shipment_id: 30012,
  purchase_order_number: 30012,
  purchase_order_state: "partially_received",
  shipment_type: "replenishment",
  reference: "PO-30012",
  created_at: "2026-01-10T06:00:00+02:00",
  due_date: "2026-01-12",
  shipped: true,
  cancelled: false,
  shipment_items: [
    {
      shipment_item_id: 500001,
      offer_id: 987654,
      quantity_required: 50,
      quantity_sending: 50,
      purchase_order_quantity_received: 44,
      purchase_order_quantity_damaged: 0,
      cancelled: false,
    },
    {
      shipment_item_id: 500002,
      offer_id: 987655,
      quantity_required: 20,
      quantity_sending: 20,
      purchase_order_quantity_received: 15,
      purchase_order_quantity_damaged: 5,
      cancelled: false,
    },
  ],
};

export const returnPayload = {
  seller_return_id: 88001,
  order_id: 5551111,
  offer_id: 987654,
  sku: "SKU-A",
  tsin_id: 111,
  quantity: 1,
  return_date: "2026-01-25",
  return_reason: "defective_or_damaged",
  return_reference_number: "RRN-88001",
  outcomes: [{ outcome_id: 1, status: "sellable_stock" }],
};

export const disbursementPayload = {
  balances: { current: 15000.5, available: 12500, held_back: 2500.5 },
};

/** Build an official-shaped list envelope. */
export function envelope(items: unknown[], continuationToken: string | null = null) {
  return {
    items,
    continuation_token: continuationToken,
    count: items.length,
    limit: 100,
  };
}
