# RecoVault — Architecture

## Architecture Style
RecoVault is a marketplace-agnostic modular monolith. The public brand is RecoVault; the internal/core namespace is `marketplace-recovery`. Marketplace-specific functionality stays behind adapters.

## High-Level Flow
Browser → Next.js server/application → core services → marketplace adapter → Supabase/PostgreSQL

Marketplace → adapter → validated source records → normalized marketplace ledger → deterministic recovery engine → recovery candidates → cases → evidence → recovery matching

## Architectural Rules
1. The dashboard is the cockpit; the ledger and recovery engine are the product.
2. Takealot is the first adapter, not the core domain.
3. Core services do not depend on Takealot-specific DTOs.
4. Marketplace credentials are server-only and encrypted before persistence.
5. Preserve validated source records separately from normalized events.
6. Syncing, normalization, detection, case creation, and recovery matching are idempotent.
7. Financial anomaly detection and recovery calculations are deterministic; LLMs cannot determine liability or recovery amounts.
8. Every candidate links to source records, rule version, inputs, calculation, and confidence.
9. Tenant isolation is enforced server-side and with PostgreSQL RLS.
10. Material state transitions are auditable.
11. Invalid external payloads fail closed.
12. Money uses exact numeric representations or integer minor units.
13. Timestamps are stored in UTC.
14. V1 does not autonomously submit marketplace claims.
15. Branding is configuration, not a core namespace.

## Locked Stack
- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui
- Lucide
- Supabase PostgreSQL
- Supabase Auth
- SQL migrations + RLS
- Zod
- Vitest
- React Testing Library
- Playwright
- selective scheduled/server-side jobs
- Vercel
- Sentry-ready observability
- Git/GitHub

## Marketplace Adapter Boundary
Core code uses a generic `MarketplaceAdapter` contract with capabilities such as:
- verifyConnection()
- listSellerMetadata()
- listOffers()
- listSales()
- listReturns()
- listShipments()
- listTransactions()
- listBalances()

Marketplace-specific auth, schemas, pagination, errors and identifiers stay under `src/integrations/<marketplace>/`.

Initial adapters:
- MockMarketplaceAdapter
- TakealotMarketplaceAdapter

## Data Flow
`marketplace_account` → `sync_job` → `source_records` → `marketplace_events` → `recovery_candidates` → `cases` → `case_evidence` → `recoveries`

## Initial Recovery Rules
- MR-001 — Inbound Shipment Discrepancy
- MR-002 — Return Financial / Outcome Mismatch
- MR-003 — Stock-Loss Event Without Matching Recovery

Ambiguous evidence produces review states, not asserted claims.

## Mock-First Development
Until real seller access exists, use synthetic contract-faithful fixtures for healthy accounts, shipment discrepancies, resolved shipments, consistent/mismatched returns, paid/unpaid stock loss, reversals, duplicate retries, malformed payloads, empty accounts, and paginated accounts.

The same recovery core must later operate against real adapters without rewriting business logic.

## Security Boundary
Marketplace credentials never appear in browser bundles, localStorage, client-readable DB responses, logs, fixtures, screenshots, or committed environment files. Decryption is server-side only.

## GREEN-Gate Testing
Required quality commands ultimately include:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`
- `npm run check`

No next milestone begins while a required check is RED.

## Repository Layout (established at Milestone 01)
```
src/
  app/            Next.js App Router (routes, layout, health endpoint)
  components/     Presentation components (shadcn/ui primitives under ui/)
  core/           Marketplace-agnostic domain (marketplace-recovery) — empty until later milestones
  integrations/   Marketplace adapters under integrations/<marketplace>/ — empty until later milestones
  recovery/       Deterministic recovery rules (MR-00x) — empty until later milestones
  lib/            Cross-cutting utilities (env validation boundary, cn helper)
tests/
  unit/           Vitest + React Testing Library
  integration/    Vitest (route/handler-level)
  e2e/            Playwright
```
Brand string `RecoVault` lives only in presentation/config; the package and domain namespace is `marketplace-recovery`.

## Pinned Toolchain (as of Milestone 01)
- Next.js 15.5.23 (App Router) — pinned to the patched 15.x line; `next lint` retained.
- React 19, TypeScript 5.7 strict (`noUncheckedIndexedAccess` enabled).
- Tailwind CSS 3.4, shadcn/ui (new-york), Lucide.
- Zod 3 for the environment/data boundary.
- Vitest 4 + React Testing Library 16, Playwright 1.49.

## MVP Completion
The mock-validated MVP must demonstrate:
Mock connection → ingestion → source records → ledger → deterministic detection → Money Finder → accepted candidate → case → evidence → manual submission tracking → recovery matching → recovered case.

Live seller validation remains a separate gated milestone.
