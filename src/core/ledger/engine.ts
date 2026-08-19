import { NORMALIZER_VERSION, normalizeSourceRecord } from "@/core/ledger/normalize";
import type {
  LedgerContext,
  LedgerStore,
  NormalizeResult,
} from "@/core/ledger/types";

/**
 * Normalize all of an account's source records into the ledger. Insertion is
 * idempotent (append-only, keyed on the deterministic event key), so
 * re-running produces no duplicates. Every event carries its source record id
 * for full traceability.
 */
export async function normalizeAccount(
  store: LedgerStore,
  ctx: LedgerContext,
): Promise<NormalizeResult> {
  const records = await store.listSourceRecords(ctx.marketplaceAccountId);
  const result: NormalizeResult = {
    eventsNormalized: 0,
    eventsInserted: 0,
    eventsUnchanged: 0,
    recordsProcessed: 0,
  };

  for (const record of records) {
    result.recordsProcessed += 1;
    for (const event of normalizeSourceRecord(record)) {
      result.eventsNormalized += 1;
      const outcome = await store.insertEvent({
        ...event,
        organizationId: ctx.organizationId,
        marketplaceAccountId: ctx.marketplaceAccountId,
        marketplace: record.marketplace,
        sourceRecordId: record.id,
        normalizerVersion: NORMALIZER_VERSION,
      });
      if (outcome === "inserted") result.eventsInserted += 1;
      else result.eventsUnchanged += 1;
    }
  }

  return result;
}

/**
 * Rebuild the account's ledger from source (dev/test): drop existing events and
 * re-normalize. Produces an equivalent ledger to the incremental path.
 */
export async function rebuildLedger(
  store: LedgerStore,
  ctx: LedgerContext,
): Promise<NormalizeResult> {
  await store.deleteEventsForAccount(ctx.marketplaceAccountId);
  return normalizeAccount(store, ctx);
}
