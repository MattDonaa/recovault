/**
 * Normalized, marketplace-independent event ledger (LEDGER LAW). The recovery
 * core consumes these canonical events without any marketplace-specific DTOs.
 */
export const EVENT_TYPES = [
  "sale",
  "shipment_item",
  "return",
  "payment",
  "charge",
  "reversal",
  "adjustment",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** The normalized event produced from a single source record. */
export interface NormalizedEvent {
  eventType: EventType;
  externalRef: string;
  sku: string | null;
  orderExternalId: string | null;
  references: Record<string, unknown>;
  quantity: number | null;
  amountMinor: number | null;
  currency: string | null;
  occurredAt: string | null;
  eventKey: string;
}

/** A source record row (from M07) fed into the normalizer. */
export interface SourceRecordRow {
  id: string;
  organizationId: string;
  marketplaceAccountId: string;
  marketplace: string;
  externalType: string;
  externalId: string;
  sourceTimestamp: string | null;
  payload: unknown;
}

export interface LedgerContext {
  organizationId: string;
  marketplaceAccountId: string;
}

export interface EventInsert extends NormalizedEvent, LedgerContext {
  marketplace: string;
  sourceRecordId: string;
  normalizerVersion: string;
}

export type InsertEventResult = "inserted" | "unchanged";

export interface LedgerStore {
  listSourceRecords(accountId: string): Promise<SourceRecordRow[]>;
  insertEvent(input: EventInsert): Promise<InsertEventResult>;
  deleteEventsForAccount(accountId: string): Promise<void>;
}

export interface NormalizeResult {
  eventsNormalized: number;
  eventsInserted: number;
  eventsUnchanged: number;
  recordsProcessed: number;
}
