# RecoVault

**Marketplace revenue recovery — SCAN • PROVE • RECOVER.**

RecoVault ingests marketplace operational and financial data, preserves
validated source records, normalizes them into an immutable event ledger, runs
deterministic recovery rules, surfaces evidence-backed recovery candidates,
supports an investigation/claim-case workflow, and reconciles subsequent
payments to verify recovery.

The internal domain namespace is `marketplace-recovery`; "RecoVault" is brand /
presentation only. The first marketplace adapter is **Takealot**, implemented
behind a generic, marketplace-agnostic adapter contract.

> **Mock-first.** The entire MVP runs and is fully validated with a
> contract-faithful **mock** marketplace adapter and synthetic fixtures — no real
> seller credentials required. Live Takealot integration is **not** validated
> until an authorized seller/API key exists. Mock/demo data is clearly labelled
> throughout the UI and is never presented as a real recovery.

## Stack
Next.js (App Router) · TypeScript (strict) · Tailwind + shadcn/ui · Supabase
(PostgreSQL + Auth + RLS) · Zod · Vitest + React Testing Library · Playwright ·
pdf-lib · Vercel deployment target.

## Prerequisites
- Node.js ≥ 20 and npm.
- (Production only) a Supabase project.

## Clean-clone setup
```bash
git clone https://github.com/MattDonaa/recovault.git
cd recovault
npm install
cp .env.example .env.local     # fill values for LIVE mode; MOCK mode needs none
npx playwright install chromium # only needed to run e2e tests
npm run dev                     # http://localhost:3000
```
With no Supabase variables set, the app runs in **MOCK mode** end-to-end
(in-memory auth + marketplace data). Sign up, create an organization, connect a
demo marketplace, run analysis, and walk the full recovery loop.

## Environment variables
All variables are documented in [`.env.example`](.env.example). Server-only
secrets (never exposed to the browser): `SUPABASE_SERVICE_ROLE_KEY`,
`AUTH_SESSION_SECRET`, `MARKETPLACE_ENCRYPTION_KEY`, `TAKEALOT_API_KEY`. A
production deployment must set every variable in `REQUIRED_PRODUCTION_ENV`
(`src/lib/env.server.ts`); `validateProductionEnv()` fails closed if any are
missing.

## Quality commands
```bash
npm run typecheck        # strict TypeScript
npm run lint             # ESLint (max-warnings=0)
npm run test             # unit (Vitest + RTL)
npm run test:integration # integration (real Postgres via embedded PGlite)
npm run test:e2e         # Playwright (runs against a production build)
npm run build            # production build
npm run check            # typecheck + lint + unit + integration + build
```
All correctness — RLS, idempotency, recovery rules, matching — is proven against
**real Postgres** (embedded PGlite), with no network dependency in CI.

## The end-to-end recovery loop (mock)
1. Connect a MOCK marketplace (choose a scenario).
2. Run analysis → source records → normalized ledger → deterministic detectors.
3. See recovery candidates in **Money Finder** (totals, filters, evidence trace).
4. Investigate → **accept** a candidate.
5. Create a **case**; generate a deterministic **evidence pack (PDF)**.
6. Mark the claim **submitted** (manual reference + date; two deadline clocks).
7. A later sync brings a matching payment → **matched** → case **recovered** →
   recovered dashboard total updates.

## Documentation
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Project state: [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md)
- Tenancy & RLS: [`docs/TENANCY.md`](docs/TENANCY.md)
- Ingestion, ledger, rules, cases, evidence, matching: see `docs/*.md`
- Deployment runbook: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Engineering constitution: [`00-claude.md`](00-claude.md)

## Security
Credentials encrypted at rest (AES-256-GCM; key from env, never in DB),
server-only decryption, tenant isolation via Row-Level Security, security
response headers, sanitized structured logging with a Sentry-ready boundary, and
no secrets in logs or the client bundle. No automatic marketplace submission
exists anywhere in the codebase.
