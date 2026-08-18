# Milestone 12 — Evidence Pack & Manual Claim Tracking

## Objective
Generate deterministic evidence packs and track claims/disputes that sellers submit manually.

## Preconditions
- Milestone 11 GREEN.

## In Scope
- Structured evidence model.
- Printable/server-generated PDF evidence pack.
- Evidence sourced only from stored candidate/case/source data.
- Calculation tables use persisted deterministic inputs.
- Seller can mark case submitted.
- Capture external marketplace ticket/reference.
- Capture submission date.
- Track manual status.
- Configurable deadline/SLA concepts.
- Keep claim-submission deadlines separate from dispute-resolution SLA clocks.
- Countdown/status derives from explicit configuration.

## Evidence Pack Minimum Content
- case ID
- marketplace/account
- issue/rule type
- SKU/offer/order/shipment/return references where relevant
- timeline
- quantities
- exact monetary calculation
- source evidence references
- confidence/rule version
- generated-at timestamp
- disclaimer that candidate is evidence-based and not a guarantee of marketplace liability

## AI Guardrail
No LLM is required.
If narrative generation is later introduced, it may summarize verified facts only and cannot alter calculations/evidence.

## Required Tests
- Evidence values exactly match persisted case/source data.
- PDF/print generation smoke test.
- No unsupported claim language.
- Submission transition requires required reference/date fields.
- Deadline calculations pass boundary/date tests.
- Separate clocks cannot be conflated.
- Cross-tenant evidence access denied.

## Explicitly Out of Scope
- Automatic marketplace claim submission.
- Browser automation into seller portal.
- LLM-based financial decisions.

## Acceptance Criteria
- AC-01: Deterministic evidence snapshot GREEN.
- AC-02: PDF generation GREEN.
- AC-03: Submitted-case audit event GREEN.
- AC-04: Deadline/SLA tests GREEN.
- AC-05: Repository contains no auto-submission implementation.

## Completion
After GREEN:
- Last GREEN Milestone = 12.
- Current Allowed Milestone = 13.
- STOP.
