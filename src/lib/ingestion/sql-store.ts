import type {
  CheckpointInput,
  FinishJobInput,
  IngestionStore,
  RejectionInput,
  SourceRecordInput,
  SyncContext,
  UpsertResult,
} from "@/core/ingestion/types";

/** Minimal SQL executor so the store works with any pg-like client (PGlite). */
export interface SqlExec {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number }>;
}

/**
 * SQL-backed ingestion store. Idempotency is enforced at the database via the
 * `(marketplace_account_id, external_type, external_id)` unique key and an
 * `ON CONFLICT ... DO UPDATE` that fires only when the payload hash changed —
 * so re-running an identical sync inserts and updates nothing, while a changed
 * payload bumps `version` and updates the payload WITHOUT erasing first-seen
 * provenance.
 */
export function createSqlIngestionStore(exec: SqlExec): IngestionStore {
  return {
    async createSyncJob(input: SyncContext & { adapter: string }) {
      const res = await exec.query<{ id: string }>(
        `insert into public.sync_jobs (organization_id, marketplace_account_id, adapter, status)
         values ($1, $2, $3, 'running') returning id`,
        [input.organizationId, input.marketplaceAccountId, input.adapter],
      );
      return res.rows[0]!.id;
    },

    async finishSyncJob(syncJobId: string, input: FinishJobInput) {
      await exec.query(
        `update public.sync_jobs set
           status = $2,
           finished_at = now(),
           pages_fetched = $3,
           records_fetched = $4,
           records_inserted = $5,
           records_updated = $6,
           records_rejected = $7,
           checkpoint = $8,
           error_code = $9,
           error_message = $10
         where id = $1`,
        [
          syncJobId,
          input.status,
          input.counts.pagesFetched,
          input.counts.recordsFetched,
          input.counts.recordsInserted,
          input.counts.recordsUpdated,
          input.counts.recordsRejected,
          input.checkpoint,
          input.error?.code ?? null,
          input.error?.message ?? null,
        ],
      );
    },

    async upsertSourceRecord(
      input: SourceRecordInput,
    ): Promise<UpsertResult> {
      const res = await exec.query<{ inserted: boolean }>(
        `insert into public.source_records (
           organization_id, marketplace_account_id, marketplace, external_type,
           external_id, source_timestamp, schema_version, payload_hash, payload,
           version, first_seen_sync_job_id, last_seen_sync_job_id
         ) values (
           $1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9::jsonb, 1, $10, $10
         )
         on conflict (marketplace_account_id, external_type, external_id) do update
           set payload = excluded.payload,
               payload_hash = excluded.payload_hash,
               source_timestamp = excluded.source_timestamp,
               schema_version = excluded.schema_version,
               last_seen_sync_job_id = excluded.last_seen_sync_job_id,
               version = public.source_records.version + 1
           where public.source_records.payload_hash is distinct from excluded.payload_hash
         returning (xmax = 0) as inserted`,
        [
          input.organizationId,
          input.marketplaceAccountId,
          input.marketplace,
          input.externalType,
          input.externalId,
          input.sourceTimestamp,
          input.schemaVersion,
          input.payloadHash,
          JSON.stringify(input.payload),
          input.syncJobId,
        ],
      );
      // No row returned → conflict with an identical hash → nothing changed.
      if (res.rows.length === 0) return "unchanged";
      return res.rows[0]!.inserted ? "inserted" : "updated";
    },

    async insertRejection(input: RejectionInput) {
      await exec.query(
        `insert into public.source_record_rejections (
           organization_id, marketplace_account_id, sync_job_id, external_type,
           reason, payload_hash, raw
         ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)
         on conflict (marketplace_account_id, external_type, payload_hash) do nothing`,
        [
          input.organizationId,
          input.marketplaceAccountId,
          input.syncJobId,
          input.externalType,
          input.reason,
          input.payloadHash,
          JSON.stringify(input.raw),
        ],
      );
    },

    async saveCheckpoint(input: CheckpointInput) {
      await exec.query(
        `insert into public.sync_checkpoints (
           organization_id, marketplace_account_id, external_type, cursor
         ) values ($1, $2, $3, $4)
         on conflict (marketplace_account_id, external_type) do update
           set cursor = excluded.cursor`,
        [
          input.organizationId,
          input.marketplaceAccountId,
          input.externalType,
          input.cursor,
        ],
      );
    },
  };
}
