# RecoVault — Ingestion & Source Records

Status: established at **Milestone 07**. Schema source of truth:
`supabase/migrations/0004_ingestion_source_records.sql`. Engine:
`src/core/ingestion/`.

Ingestion reliably pulls marketplace datasets through the generic
`MarketplaceAdapter` and preserves **validated source provenance** before any
normalization or recovery logic. It is idempotent, retry-safe, and
tenant-isolated.

## Tables
| Table | Purpose |
|-------|---------|
| `sync_jobs` | One row per ingestion run: adapter, status (`running`/`completed`/`failed`), start/finish, pages + records fetched/inserted/updated/rejected, checkpoint, sanitized error. |
| `source_records` | Validated source records with full provenance, unique per `(account, external_type, external_id)`. |
| `source_record_rejections` | Quarantined (fail-closed) payloads, deduped by `(account, external_type, payload_hash)`. |
| `sync_checkpoints` | Last cursor per `(account, external_type)` for resumable sync. |

## Provenance (SOURCE RECORD LAW)
Every `source_records` row retains: organization + marketplace account,
marketplace, external type, external id, source timestamp (where available),
ingestion timestamp, schema version, payload hash (SHA-256 over a stable
key-sorted serialization), the validated canonical payload (the "safely
retained equivalent"), `version`, and both the **first-seen** and last-seen sync
job ids.

## Idempotency & version policy
Upsert uses the DB unique key + `ON CONFLICT ... DO UPDATE ... WHERE hash
changed`:
- **new** external id → inserted (version 1);
- **same** external id, **same** hash → nothing changes (no duplicate);
- **same** external id, **changed** hash → payload updated, `version`
  incremented, `last_seen_sync_job_id` advanced, while
  `first_seen_sync_job_id` and original ingestion are preserved.

So re-running an identical sync inserts and updates zero rows, and an
interrupted sync can be safely retried — the final state is the same regardless
of how many times (or how far) it ran.

## Engine
`runSync(adapter, store, ctx)` (`src/core/ingestion/engine.ts`):
1. create a `sync_jobs` row (`running`);
2. drain each capability (offers, sales, returns, shipments, transactions) by
   continuation cursor, and balances (snapshot);
3. upsert each canonical record as a source record; persist quarantined records
   as rejections; save a checkpoint per page;
4. finish the job with counts + status; on failure record a **sanitized**
   error code/message (never a secret) and mark the job `failed`.

The engine depends only on the `IngestionStore` interface; the SQL
implementation (`src/lib/ingestion/sql-store.ts`) works with any pg-like client.
All correctness is proven against embedded Postgres (PGlite) — no network.

## Tenant isolation
`sync_jobs`, `source_records`, `source_record_rejections`, and
`sync_checkpoints` all enable RLS: members may read their organization's rows;
another tenant sees nothing. Writes are performed by trusted server code
(service role).

## Out of scope (later milestones)
Ledger normalization (M08), recovery detection (M09), cases (M11). Ingestion
only preserves provenance; it never normalizes or interprets records.
