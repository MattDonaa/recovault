# RecoVault — Project State

## Current Status
- **Last GREEN milestone:** 01 — Repository & Quality Foundation
- **Current allowed milestone:** 02 — Database & Tenancy
- **Operating mode:** MOCK-FIRST
- **Live seller credentials:** NOT AVAILABLE
- **Live marketplace validation:** BLOCKED UNTIL AUTHORIZED SELLER ACCESS EXISTS

## Implemented Modules
- **Application shell:** Next.js App Router (15.5.23), TypeScript strict mode, Tailwind CSS, shadcn/ui (Button primitive), Lucide icons.
- **Environment boundary:** Zod-validated, fail-closed env parsing (`src/lib/env.ts`) — app-level non-secret variables only.
- **Health route:** `GET /health` returns non-sensitive status.
- **Quality gate:** typecheck, lint, unit (Vitest 4 + React Testing Library), integration (Vitest), e2e (Playwright), build, and aggregate `check` scripts.
- **Module skeleton (empty, foundation only):** `src/core`, `src/integrations`, `src/recovery`, `src/lib`, `src/components`.

No product/business functionality is implemented (per Milestone 01 scope).

## Active Recovery Rules
NONE

Planned, but not implemented until their milestone is GREEN:
- MR-001 — Inbound Shipment Discrepancy
- MR-002 — Return Financial / Outcome Mismatch
- MR-003 — Stock-Loss Event Without Matching Recovery

## Database State
- **Schema migration version:** NONE
- **Supabase schema:** NOT INITIALIZED
- **RLS:** NOT INITIALIZED

## Module Status
- Authentication: NOT IMPLEMENTED — target Milestone 03
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
Milestone 01 is GREEN. Claude Code may execute **Milestone 02 ONLY** once explicitly instructed.

It must not begin Milestone 03 or later until Milestone 02 passes every mandatory GREEN gate and this document is updated.

## Next Allowed Action
Await explicit human instruction to begin Milestone 02. Then read, in order:
1. `00-claude.md`
2. `docs/PROJECT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `milestones/02-database-tenancy.md`

Run the Milestone 01 verification commands (`npm run check`, `npm run test:e2e`) before starting Milestone 02.

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
