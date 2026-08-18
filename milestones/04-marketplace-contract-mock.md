# Milestone 04 — Marketplace Contract & Mock Adapter

## Objective
Establish the marketplace-agnostic integration contract and fully test the system without real seller credentials.

## Preconditions
- Milestones 01–03 GREEN.

## In Scope
- Generic `MarketplaceAdapter` interface.
- Canonical DTOs independent of Takealot.
- Capabilities for:
  - connection verification
  - seller/merchant metadata
  - offers
  - sales
  - returns
  - shipments
  - transactions
  - balances where supported
- `MockMarketplaceAdapter`.
- Pagination abstraction.
- Zod validation at integration boundaries.
- Synthetic fixture library.
- Human-readable scenario manifests defining expected outputs.
- Mock/demo marketplace account creation clearly labeled MOCK.

## Mandatory Fixture Scenarios
1. Healthy/no-loss account.
2. Shipment discrepancy.
3. Resolved shipment.
4. Consistent return.
5. Return mismatch.
6. Stock-loss event with matching payment.
7. Stock-loss event without payment.
8. Payment followed by reversal.
9. Duplicate/retry pages.
10. Malformed external payload.
11. Empty account.
12. Large paginated account.

## Fixture Rules
- Synthetic only.
- No real seller PII.
- No secrets.
- Every scenario declares expected records and future detector expectations.
- Do not invent Takealot-specific semantics in the core contract.

## Required Tests
- Generic contract suite passes against mock adapter.
- Invalid payload fails closed.
- Pagination returns each record exactly once.
- Retry scenario produces deterministic output.
- Empty account handled cleanly.
- Large fixture does not break pagination logic.

## Explicitly Out of Scope
- Network calls to Takealot.
- Persisting source records.
- Recovery rules.
- Cases.

## Acceptance Criteria
- AC-01: Marketplace contract tests GREEN.
- AC-02: All fixture manifests validate.
- AC-03: No marketplace-specific types leak into core.
- AC-04: Mock UI/data is visibly labeled.
- AC-05: Full quality gate GREEN.

## Completion
After GREEN:
- Last GREEN Milestone = 04.
- Current Allowed Milestone = 05.
- STOP.
