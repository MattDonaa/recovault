# Milestone 01 — Repository & Quality Foundation

## Objective
Create the runnable RecoVault modular-monolith skeleton and establish the mandatory quality gate. Build no product functionality.

## Preconditions
- Read `00-claude.md`.
- Read `docs/PROJECT_STATE.md`.
- Read `docs/ARCHITECTURE.md`.
- Confirm the current allowed milestone is 01.
- No previous milestone gate is required.

## In Scope
- Initialize Next.js App Router with strict TypeScript.
- Configure Tailwind CSS.
- Initialize shadcn/ui and Lucide.
- Establish folders:
  - `src/app`
  - `src/components`
  - `src/core`
  - `src/integrations`
  - `src/recovery`
  - `src/lib`
  - `tests/unit`
  - `tests/integration`
  - `tests/e2e`
- Configure environment validation with Zod.
- Create `.env.example` containing variable names/placeholders only.
- Configure Vitest.
- Configure React Testing Library.
- Configure Playwright.
- Add package scripts required by the engineering constitution.
- Create a minimal health page/route.
- Preserve/update `docs/ARCHITECTURE.md`.
- Preserve/update `docs/PROJECT_STATE.md` only after GREEN.

## Explicitly Out of Scope
- Supabase schema.
- Authentication.
- Marketplace accounts.
- Takealot API.
- Mock marketplace data.
- Recovery rules.
- Dashboard metrics.
- Cases.
- Claims.
- PDF generation.

## Required Tests
- Unit test proves Vitest executes.
- Component/route smoke test proves application renders.
- Playwright smoke test loads the application.
- TypeScript strict-mode check.
- ESLint check.
- Production build.

## Acceptance Criteria
- AC-01: Clean dependency installation succeeds.
- AC-02: `npm run typecheck` GREEN.
- AC-03: `npm run lint` GREEN.
- AC-04: `npm run test` GREEN.
- AC-05: Playwright smoke test GREEN.
- AC-06: `npm run build` GREEN.
- AC-07: No credential or secret is committed.
- AC-08: Architecture explicitly describes a marketplace-agnostic modular monolith.
- AC-09: No Milestone 02+ functionality has been implemented.

## GREEN Gate
Claude must run all required checks and produce the formal GATE REPORT from `00-claude.md`.

If any check is RED, STOP and repair Milestone 01 only.

## Completion
Only after every check is GREEN:
- update `docs/PROJECT_STATE.md`;
- set Last GREEN Milestone = 01;
- set Current Allowed Milestone = 02;
- STOP.
