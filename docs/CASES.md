# RecoVault — Case Engine & Audit Trail

Status: established at **Milestone 11**. Schema:
`supabase/migrations/0007_cases.sql`. Core: `src/core/cases/`.

A recovery case is a controlled, auditable container created from a
**human-accepted** recovery candidate. One accepted candidate maps to at most
one case (idempotent). Every material transition is recorded append-only.

## Tables
| Table | Purpose |
|-------|---------|
| `cases` | One case per accepted candidate (`unique(recovery_candidate_id)`). Status, amount/rule snapshot, actor. |
| `case_events` | Append-only audit: actor, timestamp, from/to status, reason, metadata, correlation id. |
| `case_evidence_refs` | Candidate evidence (ledger events) carried into the case, so it stays traceable. |

All three enable RLS: members read their org's rows; writes are server-side.

## State machine
`draft → evidence_ready → submitted → under_review → accepted | disputed →
payment_expected → recovered | closed`

Transitions are explicit (`src/core/cases/status.ts`); a case may be closed from
most active states. Invalid transitions fail server-side
(`InvalidCaseTransitionError`).

## Engine
- `createCaseFromCandidate(store, {candidateId, actorUserId})`
  (`src/core/cases/engine.ts`): only when the candidate is `accepted`;
  **idempotent** (reuses the existing case); on first creation copies the
  candidate's evidence and records a `created` audit event.
- `transitionCase(store, {caseId, to, actorUserId, reason, correlationId})`:
  validates the transition, updates status, and records a `transition` audit
  event (snapshotting `from` before the update).

The engine depends only on the `CaseStore` interface. Two stores implement it:
a SQL store (`src/lib/cases/sql-store.ts`, PGlite-verified) and an in-memory
store (`src/lib/cases/memory-store.ts`) for the MOCK-first app.

## UI
From an accepted candidate in Money Finder, "Create recovery case" opens the
case (or links to the existing one). The cases list and case detail show status,
the amount/rule snapshot, valid transitions, the **audit trail**, and the
carried-over **evidence**. A MOCK banner is shown on mock financial screens.

## Money
Case amounts are a snapshot of the candidate's potential recovery in exact
integer minor units — never floating point.

## Out of scope (later milestones)
PDF evidence generation (M12), marketplace ticket submission, AI narratives,
case grouping.
