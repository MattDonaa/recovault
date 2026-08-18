import { z } from "zod";

/**
 * Canonical, marketplace-agnostic data transfer objects.
 *
 * These are the ONLY record shapes the core depends on. No marketplace-specific
 * field names, identifiers, or semantics appear here. Money is always integer
 * minor units + ISO-4217 currency (never binary floating point); timestamps are
 * ISO-8601 UTC strings.
 */

/** ISO-8601 UTC timestamp. */
export const utcTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .describe("ISO-8601 UTC timestamp");

/** ISO-4217 currency code. */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "ISO-4217 currency code");

/** Money as integer minor units (e.g. cents) + currency. Never float. */
export const moneySchema = z.object({
  minorUnits: z.number().int(),
  currency: currencySchema,
});
export type Money = z.infer<typeof moneySchema>;

const externalId = z.string().min(1).max(200);
const sku = z.string().min(1).max(200);

export const connectionStatusSchema = z.object({
  ok: z.boolean(),
  marketplace: z.string().min(1),
  mode: z.enum(["mock", "live"]),
  checkedAt: utcTimestampSchema,
  message: z.string().nullable().default(null),
});
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const sellerMetadataSchema = z.object({
  externalId,
  displayName: z.string().min(1).max(200),
  defaultCurrency: currencySchema,
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
});
export type SellerMetadata = z.infer<typeof sellerMetadataSchema>;

export const OFFER_STATUSES = ["active", "inactive"] as const;
export const offerSchema = z.object({
  externalId,
  sku,
  title: z.string().min(1).max(500),
  price: moneySchema,
  stockOnHand: z.number().int().min(0).nullable().default(null),
  status: z.enum(OFFER_STATUSES).default("active"),
});
export type Offer = z.infer<typeof offerSchema>;

export const saleSchema = z.object({
  externalId,
  orderExternalId: z.string().min(1).max(200),
  sku,
  quantity: z.number().int().min(1),
  soldAt: utcTimestampSchema,
  gross: moneySchema,
  fees: moneySchema.nullable().default(null),
  net: moneySchema.nullable().default(null),
});
export type Sale = z.infer<typeof saleSchema>;

export const RETURN_OUTCOMES = [
  "pending",
  "restocked",
  "returned_to_seller",
  "written_off",
  "refunded",
] as const;
export const returnSchema = z.object({
  externalId,
  orderExternalId: z.string().min(1).max(200).nullable().default(null),
  sku,
  quantity: z.number().int().min(1),
  outcome: z.enum(RETURN_OUTCOMES),
  reason: z.string().max(500).nullable().default(null),
  occurredAt: utcTimestampSchema,
  refund: moneySchema.nullable().default(null),
});
export type Return = z.infer<typeof returnSchema>;

export const SHIPMENT_STATUSES = [
  "pending",
  "received",
  "discrepancy",
  "resolved",
] as const;
export const shipmentSchema = z.object({
  externalId,
  reference: z.string().max(200).nullable().default(null),
  sku,
  quantitySent: z.number().int().min(0),
  quantityReceived: z.number().int().min(0),
  quantityDamaged: z.number().int().min(0).default(0),
  status: z.enum(SHIPMENT_STATUSES),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema.nullable().default(null),
});
export type Shipment = z.infer<typeof shipmentSchema>;

export const TRANSACTION_TYPES = [
  "sale",
  "fee",
  "refund",
  "adjustment",
  "reversal",
  "reimbursement",
] as const;
export const transactionSchema = z.object({
  externalId,
  type: z.enum(TRANSACTION_TYPES),
  amount: moneySchema,
  occurredAt: utcTimestampSchema,
  relatedExternalId: z.string().min(1).max(200).nullable().default(null),
  description: z.string().max(500).nullable().default(null),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const balanceSchema = z.object({
  currency: currencySchema,
  available: moneySchema,
  pending: moneySchema.nullable().default(null),
  asOf: utcTimestampSchema,
});
export type Balance = z.infer<typeof balanceSchema>;

/** The canonical record schemas keyed by capability, for generic validation. */
export const RECORD_SCHEMAS = {
  offers: offerSchema,
  sales: saleSchema,
  returns: returnSchema,
  shipments: shipmentSchema,
  transactions: transactionSchema,
  balances: balanceSchema,
} as const;

export type RecordKind = keyof typeof RECORD_SCHEMAS;
