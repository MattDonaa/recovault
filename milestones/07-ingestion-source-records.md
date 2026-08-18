# Milestone 07 — Idempotent Ingestion & Source Records

## Objective
Reliably ingest marketplace datasets and preserve validated source provenance before any normalization or recovery logic.

## Preconditions
- Milestone 06 GREEN.

## In Scope
Create persistence for:
- `sync_jobs`
- `source_records`
- sync checkpoints/cursors
- rejected/quarantined records as appropriate

Every source record must retain:
- organization/account
- marketplace
- external record type
- external ID/key
- source timestamp where available
- ingestion timestamp
- schema version
- payload hash
- validated raw payload or safe equivalent
- sync job ID

Sync behavior:
- adapter fetch
- validation
- persistence
- pagination
- retry safety
- idempotent upsert/version policy
- sanitized diagnostics
- checkpoint handling

## Required Tests
- First sync inserts expected records.
- Identical second sync creates zero duplicates.
- Changed source payload follows documented version/update policy without erasing provenance.
- Malformed record is rejected/quarantined.
- Large paginated fixture completes.
- Interrupted sync can safely retry.
- Counts in sync job match actual persisted results.
- Empty account completes successfully.
- Tenant isolation applies to source records and sync jobs.

## Explicitly Out of Scope
- Ledger normalization.
- Recovery detection.
- Cases.

## Acceptance Criteria
- AC-01: Idempotency GREEN.
- AC-02: Provenance fields complete.
- AC-03: Retry/restart consistency GREEN.
- AC-04: Sync diagnostics contain no secrets.
- AC-05: Full quality gate GREEN.

## Completion
After GREEN:
- Last GREEN Milestone = 07.
- Current Allowed Milestone = 08.
- STOP.
