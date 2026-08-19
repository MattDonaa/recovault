import type {
  EventInsert,
  InsertEventResult,
  LedgerStore,
  SourceRecordRow,
} from "@/core/ledger/types";
import type { SqlExec } from "@/lib/ingestion/sql-store";

interface SourceRow {
  id: string;
  organization_id: string;
  marketplace_account_id: string;
  marketplace: string;
  external_type: string;
  external_id: string;
  source_timestamp: string | null;
  payload: unknown;
}

/**
 * SQL-backed ledger store. Event insertion is idempotent and append-only:
 * `ON CONFLICT (marketplace_account_id, event_key) DO NOTHING`, so
 * re-normalization never duplicates events. Reads source records for
 * normalization and supports a full rebuild.
 */
export function createSqlLedgerStore(exec: SqlExec): LedgerStore {
  return {
    async listSourceRecords(accountId: string): Promise<SourceRecordRow[]> {
      const res = await exec.query<SourceRow>(
        `select id, organization_id, marketplace_account_id, marketplace,
                external_type, external_id, source_timestamp, payload
         from public.source_records
         where marketplace_account_id = $1
         order by external_type, external_id`,
        [accountId],
      );
      return res.rows.map((r) => ({
        id: r.id,
        organizationId: r.organization_id,
        marketplaceAccountId: r.marketplace_account_id,
        marketplace: r.marketplace,
        externalType: r.external_type,
        externalId: r.external_id,
        sourceTimestamp:
          r.source_timestamp === null ? null : String(r.source_timestamp),
        payload: r.payload,
      }));
    },

    async insertEvent(input: EventInsert): Promise<InsertEventResult> {
      const res = await exec.query<{ id: string }>(
        `insert into public.marketplace_events (
           organization_id, marketplace_account_id, marketplace, event_type,
           external_ref, sku, order_external_id, references_json, quantity,
           amount_minor, currency, occurred_at, source_record_id,
           normalizer_version, event_key
         ) values (
           $1, $2, $3, $4::public.marketplace_event_type, $5, $6, $7, $8::jsonb,
           $9, $10, $11, $12::timestamptz, $13, $14, $15
         )
         on conflict (marketplace_account_id, event_key) do nothing
         returning id`,
        [
          input.organizationId,
          input.marketplaceAccountId,
          input.marketplace,
          input.eventType,
          input.externalRef,
          input.sku,
          input.orderExternalId,
          JSON.stringify(input.references ?? {}),
          input.quantity,
          input.amountMinor,
          input.currency,
          input.occurredAt,
          input.sourceRecordId,
          input.normalizerVersion,
          input.eventKey,
        ],
      );
      return res.rows.length > 0 ? "inserted" : "unchanged";
    },

    async deleteEventsForAccount(accountId: string): Promise<void> {
      await exec.query(
        `delete from public.marketplace_events where marketplace_account_id = $1`,
        [accountId],
      );
    },
  };
}
