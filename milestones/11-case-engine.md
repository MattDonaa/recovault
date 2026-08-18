# Milestone 11 — Case Engine & Audit Trail

## Objective
Convert human-accepted recovery candidates into controlled, auditable recovery cases.

## Preconditions
- Milestone 10 GREEN.

## In Scope
Create:
- `cases`
- `case_events`
- `case_evidence_refs`

MVP relationship:
- one accepted recovery candidate may create one case;
- duplicate creation must be idempotent;
- do not implement case grouping unless separately authorized.

## Case State Machine
`draft -> evidence_ready -> submitted -> under_review -> accepted | disputed -> payment_expected -> recovered | closed`

Implement explicit transition rules. Invalid transitions fail server-side.

Every material transition records:
- actor
- timestamp
- from state
- to state
- reason/metadata where allowed
- correlation/request identifier where useful

## Required Tests
- Non-accepted candidate cannot create case.
- Accepted candidate can create exactly one case.
- Duplicate create request returns/reuses existing case.
- Every allowed transition succeeds.
- Every forbidden transition fails.
- Audit event created for every material transition.
- Candidate evidence remains traceable.
- Cross-tenant case access denied.

## Explicitly Out of Scope
- PDF evidence generation.
- Marketplace ticket submission.
- AI narratives.

## Acceptance Criteria
- AC-01: State machine tests GREEN.
- AC-02: Audit integrity GREEN.
- AC-03: Idempotent case creation GREEN.
- AC-04: Tenant isolation GREEN.
- AC-05: Full quality gate GREEN.

## Completion
After GREEN:
- Last GREEN Milestone = 11.
- Current Allowed Milestone = 12.
- STOP.
