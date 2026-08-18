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

## Data Layer & Tenancy (established at Milestone 02)
- **Schema source of truth:** SQL migrations under `supabase/migrations/`. No
  schema change occurs outside a committed migration.
- **Tenant boundary:** the `organization`. Tables `organizations`,
  `organization_members`, `marketplace_accounts` (metadata only),
  `audit_events` (append-only). UUID PKs, UTC `timestamptz`, FKs, uniqueness
  constraints, and indexes.
- **Isolation:** PostgreSQL Row-Level Security on every tenant table, deny
  cross-organization by default, enforced for the `authenticated` role via
  `auth.uid()`; `service_role` bypasses RLS for trusted server tasks; `anon`
  has no tenant-table grant. Full model in `docs/TENANCY.md`.
- **Typed boundary:** Zod row schemas (`src/core/tenancy/schema.ts`), a
  `Database` type for the client generic (`src/lib/db/database.types.ts`), and
  server-only Supabase client factories (`src/lib/supabase/server.ts`) with a
  server-only env boundary (`src/lib/env.server.ts`).
- **RLS testing:** migrations run against embedded Postgres (PGlite) with a
  Supabase auth shim — deterministic, offline, no Docker.

## Authentication & Authorization (established at Milestone 03)
- **Email/password auth** behind provider-agnostic contracts
  (`src/core/auth/types.ts`); the mode is chosen once in `src/lib/auth/`:
  Supabase Auth + DB in live mode, a contract-faithful in-memory provider/store
  in MOCK-FIRST/offline/test mode.
- **App-managed sessions:** an HMAC-signed `rv_session` cookie minted after the
  provider verifies credentials (`src/core/auth/session.ts`), uniform across
  modes.
- **Server-side authorization is the source of truth:** `requireSession` and
  `requireOrgAccess` (`src/core/auth/guards.ts`) enforce access in server
  components/actions regardless of UI; non-members get a 404. Edge middleware is
  a coarse first guard only. Full model in `docs/AUTH.md`.
- **Secrets:** service-role key and session secret are server-only; an E2E test
  proves they never reach the client bundle.

## Repository Layout (established at Milestone 01)
```
src/
  app/            Next.js App Router (routes, layout, health endpoint)
  components/     Presentation components (shadcn/ui primitives under ui/)
  core/           Marketplace-agnostic domain (marketplace-recovery)
    tenancy/      Row schemas/types for the tenant tables
    auth/         Auth/session/authorization contracts + guards (provider-agnostic)
  integrations/   Marketplace adapters under integrations/<marketplace>/ — empty until later milestones
  recovery/       Deterministic recovery rules (MR-00x) — empty until later milestones
  lib/            Cross-cutting infrastructure
    auth/         Provider/store wiring: mock (in-memory) + supabase (live)
    supabase/     Server-only Supabase client factories
    db/           Database type for the Supabase client generic
  middleware.ts   Edge guard redirecting unauthenticated /app/* to /login
tests/
  unit/           Vitest + React Testing Library
  integration/    Vitest (route/handler-level + RLS against embedded Postgres)
  db/             Test DB harness + Supabase auth shim (not collected as tests)
  e2e/            Playwright
supabase/
  migrations/     SQL migrations — the schema source of truth
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
