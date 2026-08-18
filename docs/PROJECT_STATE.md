# RecoVault — Project State

## Current Status
- **Last GREEN milestone:** 04 — Marketplace Contract & Mock Adapter
- **Current allowed milestone:** 05 — Takealot Adapter
- **Operating mode:** MOCK-FIRST (auth runs in MOCK mode; Supabase live path implemented but unverified)
- **Live seller credentials:** NOT AVAILABLE
- **Live marketplace validation:** BLOCKED UNTIL AUTHORIZED SELLER ACCESS EXISTS

## Implemented Modules
- **Application shell:** Next.js App Router (15.5.23), TypeScript strict mode, Tailwind CSS, shadcn/ui (Button primitive), Lucide icons.
- **Environment boundary:** Zod-validated, fail-closed env parsing — app-level public vars (`src/lib/env.ts`) and server-only Supabase vars (`src/lib/env.server.ts`).
- **Tenancy & RLS (M02):** SQL migrations (`supabase/migrations/`) defining `organizations`, `organization_members`, `marketplace_accounts` (metadata only), `audit_events` (append-only); UUID PKs, constraints, indexes; PostgreSQL Row-Level Security with deny-by-default cross-tenant isolation. Model documented in `docs/TENANCY.md`.
- **Typed DB access boundary:** Zod row schemas (`src/core/tenancy/schema.ts`), `Database` type (`src/lib/db/database.types.ts`), server-only Supabase client factories (`src/lib/supabase/server.ts`).
- **RLS test infrastructure:** migrations executed against embedded Postgres (PGlite) with a Supabase auth shim (`tests/db/`) — deterministic, offline, no Docker.
- **Authentication & authorization (M03):** email/password signup/login/logout via provider-agnostic contracts (`src/core/auth/`), HMAC-signed app session cookie, edge middleware + server-side guards (`requireSession`, `requireOrgAccess`), organization bootstrap/membership resolution, audit on org creation. Mock provider/store for offline/test; Supabase-backed live provider/store implemented (unverified until live milestone). UI shell for auth + organizations (no fabricated data). Model documented in `docs/AUTH.md`.
- **Marketplace contract & mock adapter (M04):** generic `MarketplaceAdapter` contract, canonical DTOs (money = integer minor units + ISO-4217, UTC), cursor pagination, fail-closed boundary validation (quarantine) in `src/core/marketplace/`; `MockMarketplaceAdapter` + 12 synthetic fixture scenarios with machine-checkable manifests in `src/integrations/mock/`. MOCK demo-marketplace connection UI (metadata only, not persisted). No marketplace-specific type leaks into core (test-enforced). Catalog in `docs/FIXTURES.md`.
- **Health route:** `GET /health` returns non-sensitive status.
- **Quality gate:** typecheck, lint, unit (Vitest 4 + RTL), integration (Vitest + PGlite), e2e (Playwright), build, and aggregate `check` scripts.
- **Module skeleton (empty until later milestones):** `src/integrations`, `src/recovery`.

No marketplace/recovery business functionality is implemented (per current scope). `marketplace_accounts` holds metadata only — no credentials.

## Active Recovery Rules
NONE

Planned, but not implemented until their milestone is GREEN:
- MR-001 — Inbound Shipment Discrepancy
- MR-002 — Return Financial / Outcome Mismatch
- MR-003 — Stock-Loss Event Without Matching Recovery

## Database State
- **Schema migration version:** 0002 (`0001_tenancy_core.sql`, `0002_tenancy_rls.sql`)
- **Supabase schema:** DEFINED via migrations (not yet applied to a live project)
- **RLS:** ENABLED + tested on all tenant tables (deny cross-tenant by default)

## Module Status
- Authentication & Organization Boundary: IMPLEMENTED (M03) — mock-mode verified; Supabase live path unverified
- Marketplace Contract & Mock Adapter: IMPLEMENTED (M04) — generic contract + MockMarketplaceAdapter + 12 fixtures
- Takealot Adapter: NOT IMPLEMENTED — target Milestone 05 (NEXT ALLOWED)
- Marketplace Ledger: NOT IMPLEMENTED — target Milestone 08
- Recovery Engine: NOT IMPLEMENTED — target Milestone 09
- Money Finder: NOT IMPLEMENTED — target Milestone 10
- Case Engine: NOT IMPLEMENTED — target Milestone 11
- Evidence & Claim Tracking: NOT IMPLEMENTED — target Milestone 12
- Recovery Verification: NOT IMPLEMENTED — target Milestone 13

## Known Non-Blocking Limitations
- No consenting real seller/API credentials are available.
- Development remains MOCK-FIRST.
- Live Takealot integration cannot be declared validated before the live pilot.
- No mock result may be represented as a real recovery.
- **Auth live path unverified:** the Supabase-backed `SupabaseAuthProvider` / `SupabaseMembershipStore` are implemented but not exercised offline (no Supabase project/credentials). Auth runs in MOCK mode until credentials exist; the mock provider is contract-faithful and fully tested. E2E runs against a production build.
- **Dependency audit:** 3 transitive HIGH advisories remain (`postcss` and `sharp`, both pulled in by Next.js). Their only fix is a Next.js 16 major upgrade, which removes `next lint` and would force an ESLint-flat-config migration. Both are build-time-only and non-exploitable in the current surface (`postcss` processes only our own trusted CSS; `sharp` runs only under `next/image` optimization, which is unused). Next.js is pinned to the patched **15.5.23** (direct CVE-2025-66478 resolved). The Next.js 16 migration is deferred to a dedicated, human-approved upgrade task.

## Current Development Permission
Milestone 04 is GREEN. Claude Code may execute **Milestone 05 ONLY** once explicitly instructed.

It must not begin Milestone 06 or later until Milestone 05 passes every mandatory GREEN gate and this document is updated.

## Next Allowed Action
Await explicit human instruction to begin Milestone 05. Then read, in order:
1. `00-claude.md`
2. `docs/PROJECT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `milestones/05-takealot-adapter.md`

Run the prior verification commands (`npm run check`, `npm run test:e2e`) before starting Milestone 04.

## State Update Rule
Update this file only after a milestone reaches GREEN. Record:
- last GREEN milestone
- current allowed milestone
- schema migration version
- implemented modules
- active recovery rules/versions
- mock/live status
- known non-blocking limitations
- next allowed milestone

This file records factual repository state; it is not a roadmap.
