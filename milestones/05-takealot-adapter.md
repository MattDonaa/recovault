# Milestone 05 — Takealot Adapter: Contract-Verified, No Live Credential Required

## Objective
Implement Takealot as the first real marketplace adapter while keeping CI and MVP development independent of live credentials.

## Preconditions
- Milestone 04 GREEN.
- Official Takealot API documentation/schema assumptions must be verified before implementation.

## In Scope
Create `src/integrations/takealot/` with:
- client/transport
- authentication injection
- Zod schemas
- response mapping
- pagination
- sanitized error handling
- date-window helpers
- contract implementation

Support contract capabilities needed for:
- seller metadata
- offers
- sales
- returns
- shipments
- transactions
- balances where supported

Authentication:
- API key is server-side only.
- `X-API-Key` injection belongs inside the adapter/transport.
- No key may be accepted into client-side persistence.

Pagination:
- Correctly model continuation-token semantics.
- Never assume page-number behavior if API uses tokens.

Transactions:
- Respect documented date-range limits.
- Provide deterministic window splitting for historical sync.

## Required Tests
- Official-schema-shaped synthetic responses validate.
- Mapping to canonical DTOs is deterministic.
- 403/auth error is sanitized.
- 404/empty responses handled as documented.
- Continuation token pagination works.
- Date windows split without gaps/overlap.
- API key never appears in error/log snapshots.
- Adapter passes generic MarketplaceAdapter contract suite using mocked HTTP.

## Explicitly Out of Scope
- Live API calls.
- Real API-key persistence.
- Historical database sync.
- Recovery rules.

## Acceptance Criteria
- AC-01: Takealot adapter contract suite GREEN.
- AC-02: CI has zero external-network dependency.
- AC-03: Secret leakage tests GREEN.
- AC-04: Core domain has no Takealot DTO dependency.
- AC-05: Full quality gate GREEN.

## Completion
After GREEN:
- Last GREEN Milestone = 05.
- Current Allowed Milestone = 06.
- STOP.
