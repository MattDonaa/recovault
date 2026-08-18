# Milestone 10 — Money Finder

## Objective
Expose deterministic recovery candidates through a useful seller cockpit without overstating marketplace liability.

## Preconditions
- Milestone 09 GREEN.

## In Scope
- Overview potential-recovery totals derived from persisted candidates.
- Money Finder list.
- Filters by rule, confidence, status, marketplace.
- Candidate detail.
- Evidence/source trace.
- Rule/version.
- calculation breakdown.
- deterministic confidence.
- candidate workflow:
  - detected
  - investigating
  - accepted
  - dismissed
- authorized server-side transitions.
- audit state changes.
- clear MOCK/DEMO banner for synthetic data.

## Language Guardrail
Allowed:
- potential recovery
- recovery candidate
- anomaly
- requires review

Forbidden before verified resolution:
- marketplace owes you
- guaranteed recovery
- guaranteed claim
- confirmed debt

## Required Tests
- Dashboard totals equal candidate data.
- Filters return correct candidates.
- Dismissed candidate leaves actionable totals as designed while remaining auditable.
- Accepted candidate state persists.
- Invalid transitions fail server-side.
- Cross-tenant access denied.
- Mock data label always visible on mock-derived financial screens.
- No hard-coded Takealot-centric core UI language except marketplace source labels.

## Explicitly Out of Scope
- Cases.
- Evidence PDF.
- Claim submission tracking.
- Billing.

## Acceptance Criteria
- AC-01: Mock sync → Money Finder E2E GREEN.
- AC-02: Financial totals exact.
- AC-03: Language guardrail GREEN.
- AC-04: Tenant isolation GREEN.
- AC-05: Full quality gate GREEN.

## Completion
After GREEN:
- Last GREEN Milestone = 10.
- Current Allowed Milestone = 11.
- STOP.
