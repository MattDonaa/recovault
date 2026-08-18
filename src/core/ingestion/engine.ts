import type { MarketplaceAdapter } from "@/core/marketplace/adapter";
import type { ListParams, Page } from "@/core/marketplace/pagination";
import { hashPayload } from "@/core/ingestion/hash";
import type {
  IngestionStore,
  SyncContext,
  SyncCounts,
  SyncResult,
} from "@/core/ingestion/types";

export const SOURCE_SCHEMA_VERSION = "canonical:v1";

const MAX_PAGES = 100_000;

function sanitizeError(error: unknown): { code: string; message: string } {
  const err = error as { code?: unknown; message?: unknown };
  const code = typeof err?.code === "string" ? err.code : "sync_error";
  const message =
    typeof err?.message === "string" ? err.message : "Sync failed";
  return { code, message: message.slice(0, 500) };
}

/**
 * Idempotent ingestion. Drains each capability of the adapter, validating at the
 * boundary (already done by the adapter → quarantine), and upserts canonical
 * records as source records with full provenance. Re-running the same sync
 * produces zero duplicate rows (DB unique key + upsert). Diagnostics are
 * sanitized and never contain secrets.
 */
export async function runSync(
  adapter: MarketplaceAdapter,
  store: IngestionStore,
  ctx: SyncContext,
): Promise<SyncResult> {
  const syncJobId = await store.createSyncJob({
    ...ctx,
    adapter: adapter.marketplace,
  });

  const counts: SyncCounts = {
    pagesFetched: 0,
    recordsFetched: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsRejected: 0,
  };

  async function drainPaged<T>(
    externalType: string,
    fetch: (params: ListParams) => Promise<Page<T>>,
    externalId: (record: T) => string,
    sourceTimestamp: (record: T) => string | null,
  ): Promise<void> {
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await fetch({ cursor });
      counts.pagesFetched += 1;

      for (const record of page.records) {
        counts.recordsFetched += 1;
        const result = await store.upsertSourceRecord({
          ...ctx,
          marketplace: adapter.marketplace,
          externalType,
          externalId: externalId(record),
          sourceTimestamp: sourceTimestamp(record),
          schemaVersion: SOURCE_SCHEMA_VERSION,
          payloadHash: hashPayload(record),
          payload: record,
          syncJobId,
        });
        if (result === "inserted") counts.recordsInserted += 1;
        else if (result === "updated") counts.recordsUpdated += 1;
      }

      for (const quarantined of page.quarantined) {
        counts.recordsRejected += 1;
        await store.insertRejection({
          ...ctx,
          syncJobId,
          externalType,
          reason: quarantined.reason,
          payloadHash: hashPayload(quarantined.raw),
          raw: quarantined.raw,
        });
      }

      cursor = page.nextCursor;
      await store.saveCheckpoint({ ...ctx, externalType, cursor });
      pages += 1;
      if (pages > MAX_PAGES) throw new Error("Sync exceeded maximum page count");
    } while (cursor !== null);
  }

  try {
    await drainPaged("offers", (p) => adapter.listOffers(p), (r) => r.externalId, () => null);
    await drainPaged("sales", (p) => adapter.listSales(p), (r) => r.externalId, (r) => r.soldAt);
    await drainPaged("returns", (p) => adapter.listReturns(p), (r) => r.externalId, (r) => r.occurredAt);
    await drainPaged("shipments", (p) => adapter.listShipments(p), (r) => r.externalId, (r) => r.createdAt);
    await drainPaged("transactions", (p) => adapter.listTransactions(p), (r) => r.externalId, (r) => r.occurredAt);

    if (adapter.capabilities.balances && adapter.listBalances) {
      const balances = await adapter.listBalances();
      counts.pagesFetched += 1;
      for (const balance of balances) {
        counts.recordsFetched += 1;
        const result = await store.upsertSourceRecord({
          ...ctx,
          marketplace: adapter.marketplace,
          externalType: "balances",
          externalId: balance.currency,
          sourceTimestamp: balance.asOf,
          schemaVersion: SOURCE_SCHEMA_VERSION,
          payloadHash: hashPayload(balance),
          payload: balance,
          syncJobId,
        });
        if (result === "inserted") counts.recordsInserted += 1;
        else if (result === "updated") counts.recordsUpdated += 1;
      }
    }
  } catch (error) {
    const sanitized = sanitizeError(error);
    await store.finishSyncJob(syncJobId, {
      status: "failed",
      counts,
      checkpoint: null,
      error: sanitized,
    });
    return { syncJobId, status: "failed", counts, error: sanitized };
  }

  await store.finishSyncJob(syncJobId, {
    status: "completed",
    counts,
    checkpoint: null,
    error: null,
  });
  return { syncJobId, status: "completed", counts, error: null };
}
