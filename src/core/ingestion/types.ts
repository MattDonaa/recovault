/**
 * Ingestion persistence contract. The engine depends only on this interface;
 * concrete stores (SQL/Supabase) implement it. Every source record retains full
 * provenance (SOURCE RECORD LAW).
 */
export type UpsertResult = "inserted" | "updated" | "unchanged";

export interface SyncCounts {
  pagesFetched: number;
  recordsFetched: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsRejected: number;
}

export interface SyncContext {
  organizationId: string;
  marketplaceAccountId: string;
}

export interface SourceRecordInput extends SyncContext {
  marketplace: string;
  externalType: string;
  externalId: string;
  sourceTimestamp: string | null;
  schemaVersion: string;
  payloadHash: string;
  payload: unknown;
  syncJobId: string;
}

export interface RejectionInput extends SyncContext {
  syncJobId: string;
  externalType: string;
  reason: string;
  payloadHash: string;
  raw: unknown;
}

export interface CheckpointInput extends SyncContext {
  externalType: string;
  cursor: string | null;
}

export interface FinishJobInput {
  status: "completed" | "failed";
  counts: SyncCounts;
  checkpoint: string | null;
  error: { code: string; message: string } | null;
}

export interface IngestionStore {
  createSyncJob(input: SyncContext & { adapter: string }): Promise<string>;
  finishSyncJob(syncJobId: string, input: FinishJobInput): Promise<void>;
  upsertSourceRecord(input: SourceRecordInput): Promise<UpsertResult>;
  insertRejection(input: RejectionInput): Promise<void>;
  saveCheckpoint(input: CheckpointInput): Promise<void>;
}

export interface SyncResult {
  syncJobId: string;
  status: "completed" | "failed";
  counts: SyncCounts;
  error: { code: string; message: string } | null;
}
