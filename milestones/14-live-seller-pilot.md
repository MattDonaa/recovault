# Milestone 14 — Live Seller Pilot Validation

## Status
BLOCKED until a consenting real seller provides authorized marketplace API access and pilot permission.

This is not a RED milestone while credentials are unavailable.

## Objective
Validate real marketplace ingestion, schema assumptions, reconciliation behavior and recovery precision without opportunistically changing core rules.

## Entry Conditions
- Milestones 01–13 GREEN.
- Explicit authorization from a real seller.
- Seller understands read-only pilot scope.
- Credential handling uses Milestone 06 secure flow.
- No production/public claims are made before validation.

## Procedure
1. Record pilot authorization and agreed data-handling scope.
2. Configure LIVE marketplace account through secure connection flow.
3. Verify connection server-side.
4. Run minimal read-only metadata request.
5. Run limited date-range sync.
6. Compare counts/samples against seller-visible marketplace records.
7. Review schema validation failures before expanding sync.
8. Expand historical sync gradually.
9. Normalize ledger.
10. Run existing MR-001/MR-002/MR-003 without changing predicates merely to create findings.
11. Human-review every HIGH candidate.
12. Record false positives, missing evidence and unmatched events.
13. If seller chooses to submit a claim, ClaimPilot tracks it manually; no auto-submission.
14. Track eventual recovery outcome where available.

## Required Pilot Metrics
- connection success
- ingestion success/error rate
- schema validation failure rate
- duplicate rate
- normalization error rate
- candidates by rule
- candidate monetary value
- human-confirmed candidate count/value
- false positives by rule/reason
- detector precision by rule
- unresolved/insufficient-evidence count
- eventual recovery outcomes where observable

## Rule Change Guardrail
If live data disproves a rule assumption:
- mark the affected rule/problem RED for live validation;
- document evidence;
- modify rule specification deliberately;
- add regression fixtures/tests;
- rerun complete affected gates.
Never patch around live data silently.

## Required Tests
- Live connection verified without credential exposure.
- Read-only sync.
- Live source records validate or fail closed.
- No duplicate records on repeat sync.
- Candidate human-review workflow.
- Tenant/security regression remains GREEN.

## Acceptance Criteria
- AC-01: Real adapter behavior verified.
- AC-02: Live ingestion is trustworthy.
- AC-03: Pilot report documents precision and limitations.
- AC-04: No automatic claims submitted.
- AC-05: Human owner explicitly accepts pilot report.

## Completion
Only after accepted pilot validation:
- Last GREEN Milestone = 14.
- Current Allowed Milestone = 15.
- STOP.
