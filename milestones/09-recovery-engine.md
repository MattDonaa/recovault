# Milestone 09 — Deterministic Recovery Engine

## Objective
Implement the first three versioned recovery detector families with deterministic calculations and explainable evidence.

## Preconditions
- Milestone 08 GREEN.

## In Scope
Create:
- recovery rule interface
- rule registry
- rule versioning
- `recovery_candidates`
- evidence/source references
- calculation inputs
- deterministic confidence scoring
- `docs/RECOVERY_RULES.md`

## Rule MR-001 — Inbound Shipment Discrepancy
Core concept:
`unaccounted = quantity_sending - quantity_received - quantity_damaged - other explicitly accounted quantities`

Requirements:
- only run when required evidence exists;
- never treat absent quantity fields as zero unless contract explicitly guarantees zero;
- no candidate if all units are accounted for;
- recovery valuation formula must be documented and deterministic.

## Rule MR-002 — Return Financial / Outcome Mismatch
- Define exact permitted predicates before enabling.
- Detect explicit contradictions between canonical return outcomes and expected linked inventory/financial events.
- Ambiguous or incomplete evidence cannot become HIGH confidence.
- Do not generalize beyond tested predicates.

## Rule MR-003 — Stock-Loss Event Without Matching Recovery
- Require verified canonical loss event/reference.
- Search for matching recovery/payment using documented identifiers and window.
- Do not flag when a valid matching payment exists.
- Handle reversal as an explicit subsequent event.

## Confidence
Rule-based only.
Each rule documents:
- required evidence
- disqualifiers
- scoring inputs
- thresholds
- explanation

## Required Tests Per Rule
- positive case
- healthy negative
- boundary case
- missing evidence
- duplicate execution
- exact amount
- exact confidence
- rule version persisted

Also:
- healthy fixture produces zero false positives.
- scenario manifest expected outputs match exactly.

## Explicitly Out of Scope
- AI/LLM detection.
- Case creation.
- PDF.
- Automatic claim submission.

## Acceptance Criteria
- AC-01: All rule truth tables GREEN.
- AC-02: Healthy fixture has zero candidates.
- AC-03: Expected scenario candidates/amounts exact.
- AC-04: Re-running engine creates no duplicates.
- AC-05: Every candidate is explainable from source → ledger → rule → calculation.

## Completion
After GREEN:
- update active rules and versions in Project State;
- Last GREEN Milestone = 09;
- Current Allowed Milestone = 10;
- STOP.
