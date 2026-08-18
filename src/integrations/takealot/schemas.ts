import { z, type ZodType, type ZodTypeDef } from "zod";

/**
 * Zod schemas for Takealot Marketplace API responses. Encoded ONLY from fields
 * verified in the official OpenAPI spec (docs/TAKEALOT_API.md). Unknown/extra
 * fields are tolerated (APIs add fields); known fields are type-checked so
 * malformed payloads fail closed. Free-form-but-documented enums (transaction
 * type, return reason, shipment state) are accepted as strings and normalized
 * deterministically in the mapper, so additive API enum values are not
 * silently quarantined.
 */

const int = z.number().int();
const num = z.number();
const str = z.string();

export const takealotSellerWarehouseStockSchema = z
  .object({
    seller_warehouse_id: int.optional(),
    quantity_available: num.optional(),
  })
  .passthrough();

export const takealotOfferSchema = z
  .object({
    offer_id: int,
    sku: str,
    barcode: str.nullish(),
    title: str,
    selling_price: num,
    rrp: num.nullish(),
    status: str,
    seller_warehouse_stock: z
      .array(takealotSellerWarehouseStockSchema)
      .nullish(),
  })
  .passthrough();
export type TakealotOffer = z.infer<typeof takealotOfferSchema>;

export const takealotSaleSchema = z
  .object({
    order_id: int,
    order_item_id: int,
    offer_id: int.nullish(),
    sku: str,
    tsin_id: int.nullish(),
    quantity: int,
    order_date: str,
    selling_price: num,
    total_fees: num.nullish(),
    sale_status: str.nullish(),
    sales_region: str.nullish(),
    stock_source_region: str.nullish(),
  })
  .passthrough();
export type TakealotSale = z.infer<typeof takealotSaleSchema>;

export const takealotTransactionReferenceSchema = z
  .object({
    order_id: int.nullish(),
    order_item_id: int.nullish(),
    offer_id: int.nullish(),
    purchase_order_number: int.nullish(),
    return_reference_number: str.nullish(),
    removal_order_item_id: int.nullish(),
    item_quantity: int.nullish(),
    rule: str.nullish(),
    manual_reference: str.nullish(),
  })
  .passthrough();

export const takealotTransactionSchema = z
  .object({
    transaction_id: int,
    transaction_type: str,
    amount_incl_vat: num,
    vat_multiplier: num.nullish(),
    created_at: str,
    references: z.array(takealotTransactionReferenceSchema).nullish(),
  })
  .passthrough();
export type TakealotTransaction = z.infer<typeof takealotTransactionSchema>;

export const takealotShipmentItemSchema = z
  .object({
    shipment_item_id: int,
    offer_id: int.nullish(),
    quantity_required: int.nullish(),
    quantity_sending: int.nullish(),
    purchase_order_quantity_received: int.nullish(),
    purchase_order_quantity_damaged: int.nullish(),
    cancelled: z.boolean().nullish(),
    created_at: str.nullish(),
  })
  .passthrough();

export const takealotShipmentSchema = z
  .object({
    shipment_id: int,
    purchase_order_number: int.nullish(),
    purchase_order_state: str.nullish(),
    shipment_type: str.nullish(),
    reference: str.nullish(),
    created_at: str.nullish(),
    due_date: str.nullish(),
    shipped: z.boolean().nullish(),
    cancelled: z.boolean().nullish(),
    shipment_items: z.array(takealotShipmentItemSchema).nullish(),
  })
  .passthrough();
export type TakealotShipment = z.infer<typeof takealotShipmentSchema>;

export const takealotReturnOutcomeSchema = z
  .object({
    outcome_id: int.nullish(),
    status: str,
  })
  .passthrough();

export const takealotReturnSchema = z
  .object({
    seller_return_id: int,
    order_id: int.nullish(),
    offer_id: int.nullish(),
    sku: str,
    tsin_id: int.nullish(),
    quantity: int,
    return_date: str,
    return_reason: str.nullish(),
    return_reference_number: str.nullish(),
    outcomes: z.array(takealotReturnOutcomeSchema).nullish(),
  })
  .passthrough();
export type TakealotReturn = z.infer<typeof takealotReturnSchema>;

export const takealotSellerSchema = z
  .object({
    seller_id: int,
    uuid: str.nullish(),
    display_name: str,
    legal_name: str.nullish(),
    countries: z.array(str).nullish(),
  })
  .passthrough();
export type TakealotSeller = z.infer<typeof takealotSellerSchema>;

export const takealotDisbursementSchema = z
  .object({
    balances: z
      .object({
        current: num.nullish(),
        available: num.nullish(),
        held_back: num.nullish(),
      })
      .passthrough(),
  })
  .passthrough();
export type TakealotDisbursement = z.infer<typeof takealotDisbursementSchema>;

/** Generic list wrapper: { items, continuation_token, count, limit }. */
export interface TakealotListResponse<T> {
  items: T[];
  continuation_token: string | null;
  count: number | null;
  limit: number | null;
}

export function takealotListResponseSchema<T>(
  itemSchema: ZodType<T, ZodTypeDef, unknown>,
): ZodType<TakealotListResponse<T>, ZodTypeDef, unknown> {
  return z
    .object({
      items: z.array(itemSchema),
      continuation_token: str.nullish().transform((v) => v ?? null),
      count: int.nullish().transform((v) => v ?? null),
      limit: int.nullish().transform((v) => v ?? null),
    })
    .passthrough() as unknown as ZodType<
    TakealotListResponse<T>,
    ZodTypeDef,
    unknown
  >;
}

/**
 * List envelope with items left unknown, so each item can be validated
 * individually (per-record quarantine) rather than failing the whole page.
 */
export const takealotEnvelopeSchema = z
  .object({
    items: z.array(z.unknown()),
    continuation_token: str.nullish().transform((v) => v ?? null),
    count: int.nullish().transform((v) => v ?? null),
    limit: int.nullish().transform((v) => v ?? null),
  })
  .passthrough();
export type TakealotEnvelope = z.infer<typeof takealotEnvelopeSchema>;

/** Error body shapes (DefaultError/Error/Forbidden/Validation). */
export const takealotErrorSchema = z
  .object({
    message: str.nullish(),
    title: str.nullish(),
    errors: z.array(z.unknown()).nullish(),
  })
  .passthrough();
