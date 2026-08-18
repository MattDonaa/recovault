# RecoVault — Mock Marketplace Fixtures

Status: established at **Milestone 04**. Source of truth:
`src/integrations/mock/fixtures/`.

All fixtures are **synthetic** — no real seller, PII, or secrets. They serve the
generic `MarketplaceAdapter` contract (`src/core/marketplace/`) through the
`MockMarketplaceAdapter`, letting the whole system be exercised without real
credentials. Money is integer minor units + ISO-4217 currency; timestamps are
UTC. Each scenario ships a machine-checkable manifest declaring the expected
validated record counts and the expected recovery-rule outcomes (detector
expectations are **declared** here; the rules themselves run in a later
milestone).

## Contract surface
- `verifyConnection`, `listSellerMetadata`
- `listOffers`, `listSales`, `listReturns`, `listShipments`, `listTransactions`
  (cursor-paginated; every record yielded exactly once)
- `listBalances` (where supported)
- Invalid payloads fail closed: they are **quarantined** (retained raw, never
  normalized), surfaced separately from valid records.

## Scenarios (12 mandatory)
| Key | Expected (o/s/r/sh/tx/bal, quarantined) | Detector expectation |
|-----|------------------------------------------|----------------------|
| `healthy` | 2/2/1/1/2/1, q0 | MR-001/002/003 no_candidate |
| `shipment-discrepancy` | 1/0/0/1/0/1, q0 | MR-001 candidate (6 unaccounted) |
| `resolved-shipment` | 1/0/0/1/1/1, q0 | MR-001 no_candidate (reimbursed) |
| `consistent-return` | 1/1/1/0/1/1, q0 | MR-002 no_candidate |
| `return-mismatch` | 1/1/1/0/0/1, q0 | MR-002 candidate (refund w/o transaction) |
| `stock-loss-paid` | 1/0/0/1/1/1, q0 | MR-003 no_candidate |
| `stock-loss-unpaid` | 1/0/0/1/0/1, q0 | MR-003 candidate |
| `payment-reversal` | 1/0/0/1/2/1, q0 | MR-003 candidate (reimbursement reversed) |
| `duplicate-retry` | 1/3/0/0/0/1, q0 | idempotency (duplicate external id) |
| `malformed-payload` | 1/1/0/0/0/1, **q5** | fail closed; malformed quarantined |
| `empty-account` | 0/0/0/0/0/0, q0 | all no_candidate |
| `large-account` | 20/137/0/0/137/1, q0 | pagination correctness |

(o=offers, s=sales, r=returns, sh=shipments, tx=transactions, bal=balances.)

## Guarantees under test
- The generic contract suite passes against the mock adapter
  (`tests/unit/marketplace-adapter.test.ts`).
- Every manifest's declared counts equal the counts produced by validating the
  fixture data (`tests/unit/marketplace-manifests.test.ts`).
- Malformed payloads are quarantined, not normalized (fail closed).
- Pagination returns each record exactly once, including the large fixture.
- The retry/duplicate scenario is deterministic across repeated reads.
- The empty account is handled cleanly.
- No marketplace-specific name or type leaks into `src/core`
  (`tests/unit/core-purity.test.ts`).

## Using a fixture in the app
An organization owner/admin can connect a **MOCK** demo marketplace from the
organization page (`/app/org/[orgId]`), pick a scenario, and view the
adapter-derived record counts on the account page — every surface is clearly
labeled MOCK / synthetic. No mock data is presented as a real recovery, and no
records are persisted to the database (persistence is a later milestone).
