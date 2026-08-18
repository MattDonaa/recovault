# RecoVault — Project State

## Current Status
- **Last GREEN milestone:** 02 — Database, Tenancy & Row-Level Security
- **Current allowed milestone:** 03 — Authentication & Organization
- **Operating mode:** MOCK-FIRST
- **Live seller credentials:** NOT AVAILABLE
- **Live marketplace validation:** BLOCKED UNTIL AUTHORIZED SELLER ACCESS EXISTS

## Implemented Modules
- **Application shell:** Next.js App Router (15.5.23), TypeScript strict mode, Tailwind CSS, shadcn/ui (Button primitive), Lucide icons.
- **Environment boundary:** Zod-validated, fail-closed env parsing — app-level public vars (`src/lib/env.ts`) and server-only Supabase vars (`src/lib/env.server.ts`).
- **Tenancy & RLS (M02):** SQL migrations (`supabase/migrations/`) defining `organizations`, `organization_members`, `marketplace_accounts` (metadata only), `audit_events` (append-only); UUID PKs, constraints, indexes; PostgreSQL Row-Level Security with deny-by-default cross-tenant isolation. Model documented in `docs/TENANCY.md`.
- **Typed DB access boundary:** Zod row schemas (`src/core/tenancy/schema.ts`), `Database` type (`src/lib/db/database.types.ts`), server-only Supabase client factories (`src/lib/supabase/server.ts`).
- **RLS test infrastructure:** migrations executed against embedded Postgres (PGlite) with a Supabase auth shim (`tests/db/`) — deterministic, offline, no Docker.
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
- Authentication: NOT IMPLEMENTED — target Milestone 03 (NEXT ALLOWED)
- Mock Marketplace Adapter: NOT IMPLEMENTED — target Milestone 04
- Takealot Adapter: NOT IMPLEMENTED — target Milestone 05
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
- **Dependency audit:** 3 transitive HIGH advisories remain (`postcss` and `sharp`, both pulled in by Next.js). Their only fix is a Next.js 16 major upgrade, which removes `next lint` and would force an ESLint-flat-config migration. Both are build-time-only and non-exploitable in the current surface (`postcss` processes only our own trusted CSS; `sharp` runs only under `next/image` optimization, which is unused). Next.js is pinned to the patched **15.5.23** (direct CVE-2025-66478 resolved). The Next.js 16 migration is deferred to a dedicated, human-approved upgrade task.

## Current Development Permission
Milestone 02 is GREEN. Claude Code may execute **Milestone 03 ONLY** once explicitly instructed.

It must not begin Milestone 04 or later until Milestone 03 passes every mandatory GREEN gate and this document is updated.

## Next Allowed Action
Await explicit human instruction to begin Milestone 03. Then read, in order:
1. `00-claude.md`
2. `docs/PROJECT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `milestones/03-auth-organization.md`

Run the prior verification commands (`npm run check`, `npm run test:e2e`) before starting Milestone 03.

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
