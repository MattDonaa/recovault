# Milestone 08 — Normalized Marketplace Ledger

## Objective
Convert validated source records into an append-oriented, marketplace-independent event ledger.

## Preconditions
- Milestone 07 GREEN.

## In Scope
Create `marketplace_events` and normalizers for MVP-required:
- sales
- shipment/shipment-item events
- returns/outcomes
- financial transactions/payments/loss events

Every event must include:
- tenant/account
- marketplace
- canonical event type
- canonical entity references
- quantity where applicable
- exact monetary amount where applicable
- `occurred_at`
- source record reference(s)
- normalizer version
- deterministic event key

Implement:
- deterministic normalization
- idempotent event insertion
- source-to-event traceability
- rebuild-from-source command for test/dev

## Financial Rules
- Never use JS floating point for financial truth.
- Use integer minor units or exact database numeric representation.
- Explicitly test rounding/conversion boundaries.

## Required Tests
- Same source produces same event key.
- Re-normalization creates no duplicates.
- Every event traces to source record(s).
- Monetary values are exact.
- Fixture scenarios normalize to expected event snapshots.
- Marketplace-specific source enums map to canonical event types.
- Rebuild from source reproduces equivalent ledger.

## Explicitly Out of Scope
- Recovery candidate generation.
- Confidence scoring.
- Cases.

## Acceptance Criteria
- AC-01: Ledger scenario snapshots GREEN.
- AC-02: Provenance traversal GREEN.
- AC-03: Idempotency GREEN.
- AC-04: Financial exactness GREEN.
- AC-05: Recovery core can consume canonical events without Takealot DTOs.

## Completion
After GREEN:
- Last GREEN Milestone = 08.
- Current Allowed Milestone = 09.
- STOP.
