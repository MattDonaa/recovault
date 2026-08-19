# RecoVault — Recovery Verification (Closing the Loop)

Status: established at **Milestone 13**. Schema:
`supabase/migrations/0009_recovery_records.sql`. Core:
`src/core/recovery/matching.ts`, `src/core/recovery/match-engine.ts`.

After a case is opened for a detected loss, a later marketplace sync may bring in
a matching reimbursement/payment. The matcher verifies the recovery
deterministically and closes the loop.

## `recovery_records`
One row per recovery/payment event (idempotent on
`(account, marketplace_event)`), with `status`:
`matched` · `unmatched` · `reversed` · `needs_review`. Tenant-isolated by RLS.

## Matching rules (deterministic)
For each recovery payment (a `payment` ledger event with
`references.canonicalType = "reimbursement"`), matched against **open** cases
(status not `recovered`/`closed`) by canonical identifier —
`payment.relatedExternalId == case's loss reference` (the candidate's
`external_ref`):

| Situation | Decision | Case effect |
|---|---|---|
| exactly one open case, payment not reversed | `matched` | closed to `recovered` if the case is in `payment_expected` |
| the matched payment was reversed | `reversed` | case unchanged (not a valid recovery) |
| more than one open case matches | `needs_review` | **never** closed (ambiguous) |
| no open case matches | `unmatched` | none |

- Canonical identifiers are used first; time windows are not required for this
  identifier match.
- Reversal handling is explicit and auditable: a reversal event whose
  `relatedExternalId` equals the payment's external ref invalidates that
  recovery.
- Unmatched payments remain unmatched (recorded, not discarded).

## Closure & totals
A valid match on a case in `payment_expected` transitions it to `recovered`
and records a `transition` audit event. The **recovered total** (Money Finder,
shown in green — verified recovery only) sums `matched` recovery amounts in exact
integer minor units.

## Stores
- SQL store `src/lib/recovery/match-sql-store.ts` (PGlite-verified).
- In-memory store `src/lib/recovery/memory-recovery.ts` (MOCK-first app), plus a
  clearly-labelled **demo** affordance (`ingestDemoRecovery`) that injects a
  matching payment so the mock end-to-end loop can be closed without a real
  marketplace. Real recoveries arrive only via an actual sync.

## Guardrail
No automatic marketplace submission or browser automation exists anywhere
(enforced by a source-scan test). RecoVault only records the seller's own manual
claim and verifies incoming recoveries from ingested data.
