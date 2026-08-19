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

## Marketplace Contract & Mock Adapter (established at Milestone 04)
- **Generic contract** (`src/core/marketplace/`): a single `MarketplaceAdapter`
  interface with capabilities (connection, seller metadata, offers, sales,
  returns, shipments, transactions, balances), canonical Zod DTOs (money as
  integer minor units + ISO-4217; UTC timestamps), an opaque cursor pagination
  abstraction, and fail-closed boundary validation that quarantines malformed
  payloads (never normalizes them).
- **Mock adapter + fixtures** (`src/integrations/mock/`): `MockMarketplaceAdapter`
  serves 12 synthetic scenario fixtures, each with a machine-checkable manifest
  declaring expected record counts and future detector outcomes. Full catalog in
  `docs/FIXTURES.md`.
- **Core purity:** no marketplace-specific name or type appears in `src/core`,
  and core never imports `@/integrations` (enforced by test).
- **UI:** organizations can connect a **MOCK** demo marketplace (metadata only,
  clearly labeled, not persisted) and view adapter-derived counts.

## Evidence Pack & Manual Claim Tracking (established at Milestone 12)
- **Deterministic evidence pack** (`src/core/evidence/`): a pure snapshot built
  only from persisted case/candidate/source data (exact minor-unit money, no
  LLM, non-guarantee disclaimer). Server-generated **PDF** via `pdf-lib`
  (offline) at `GET /app/org/[orgId]/cases/[caseId]/evidence` (member-only, 404
  cross-tenant).
- **Manual claim tracking** (migration 0008 adds claim columns to `cases`):
  `submitCase` requires an external reference + submission date, records a
  `submitted` audit event, and sets **two separate deadline clocks** —
  submission (anchored on discovery) and dispute SLA (anchored on submission),
  computed by distinct functions so they cannot be conflated
  (`src/core/claims/`).
- **No auto-submission anywhere** (source-scan test enforced). Model in
  `docs/EVIDENCE_CLAIMS.md`.

## Case Engine & Audit Trail (established at Milestone 11)
- **`cases`, `case_events`, `case_evidence_refs`** (migration 0007): a case per
  accepted candidate (`unique(recovery_candidate_id)` → idempotent), append-only
  audit trail (actor/timestamp/from/to/reason/correlation), and carried-over
  evidence refs. Tenant-isolated by RLS.
- **State machine** (`src/core/cases/`): `draft → evidence_ready → submitted →
  under_review → accepted | disputed → payment_expected → recovered | closed`;
  explicit transitions, invalid ones fail server-side.
- **Engine:** `createCaseFromCandidate` (accepted-only, idempotent, copies
  evidence, audits creation) + `transitionCase` (validated, audits every
  material change). SQL store (PGlite-verified) + in-memory store (app). UI to
  create/advance cases with audit + evidence. Model in `docs/CASES.md`.

## Money Finder & Brand (established at Milestone 10)
- **Money Finder** (`src/app/app/org/[orgId]/money-finder/`): overview
  potential-recovery totals (exact minor units), candidate list with filters
  (rule/confidence/status/marketplace), candidate detail with calculation +
  evidence/source trace, and the `detected → investigating → accepted |
  dismissed` workflow with authorized, audited server-side transitions. A MOCK
  banner is always shown on mock financial screens; a language guardrail forbids
  liability overstatement. Model in `docs/MONEY_FINDER.md`.
- **MOCK-first pipeline:** the app runs the same deterministic core in memory
  (`src/lib/marketplace/analysis.ts`, `money-finder-store.ts`) — identical to
  the PGlite-verified DB path — so the cockpit works offline with exact money.
- **Brand system applied** (first dashboard UI): self-hosted Inter/Manrope
  fonts, navy-first palette with restrained gold (green = verified only), brand
  tokens (`src/config/brand.ts`, `globals.css`), `BrandLogo`, favicon.

## Deterministic Recovery Engine (established at Milestone 09)
- **Rules** (`src/core/recovery/`, marketplace-agnostic): versioned MR-001
  (inbound shipment discrepancy), MR-002 (return outcome/financial mismatch),
  MR-003 (stock-loss without matching recovery). Pure, deterministic detectors
  over canonical ledger events; documented required-evidence, disqualifiers,
  scoring, thresholds, and explanation. No LLM in money/anomaly/eligibility.
- **Persistence** (migration 0006): `recovery_candidates` (rule + version,
  status `detected`, confidence band + score, exact `potential_recovery_minor`
  bigint, calculation inputs, deterministic candidate key) and
  `recovery_candidate_evidence` (candidate → `marketplace_events`) for full
  source→ledger→rule→calculation traceability. Tenant-isolated by RLS.
- **Engine:** idempotent candidate insertion (`ON CONFLICT DO NOTHING`) +
  evidence linking; rebuild support. Proven on PGlite; outputs match the fixture
  manifests exactly (healthy → zero). Rules documented in `docs/RECOVERY_RULES.md`.

## Normalized Marketplace Ledger (established at Milestone 08)
- **`marketplace_events`** (migration 0005): append-oriented, marketplace-
  independent event ledger derived deterministically from source records.
  LEDGER LAW columns incl. exact money (`amount_minor` bigint integer minor
  units), `source_record_id` (traceability), normalizer version, and a
  deterministic `event_key` unique per account. Tenant-isolated by RLS.
- **Normalizers** (`src/core/ledger/`, marketplace-agnostic): sales → `sale`,
  shipments → `shipment_item`, returns → `return`, transactions → `payment`/
  `charge`/`reversal`/`adjustment` (canonical source enum → canonical event
  type). Deterministic; idempotent insert (`ON CONFLICT DO NOTHING`);
  rebuild-from-source for dev/test. The recovery core consumes these events with
  no Takealot DTOs. Model in `docs/LEDGER.md`.

## Ingestion & Source Records (established at Milestone 07)
- **Persistence** (migration 0004): `sync_jobs`, `source_records`,
  `source_record_rejections`, `sync_checkpoints` — all tenant-isolated by RLS
  (members read their org; writes server/service-role).
- **Provenance** (SOURCE RECORD LAW): org/account, marketplace, external
  type/id, source + ingestion timestamps, schema version, SHA-256 payload hash,
  validated canonical payload, sync job id; first-seen provenance is immutable.
- **Idempotent engine** (`src/core/ingestion/`): adapter fetch → validate
  (fail-closed quarantine) → `ON CONFLICT` upsert keyed on
  `(account, external_type, external_id)` → checkpoint → sanitized diagnostics.
  Re-running an identical sync changes nothing; interrupted syncs retry safely.
  Store implementations are pg-like (`src/lib/ingestion/sql-store.ts`); proven
  on PGlite. Model in `docs/INGESTION.md`.

## Secure Marketplace Connection (established at Milestone 06)
- **Credential separation:** encrypted secrets live in a dedicated
  `marketplace_credentials` table (migration 0003), separate from account
  metadata; the running app's in-memory store likewise holds only ciphertext.
- **Encryption:** AES-256-GCM (`src/core/security/crypto.ts`), key from env
  (`MARKETPLACE_ENCRYPTION_KEY`), **never in the DB**, decrypt server-side only,
  tamper-evident. Plaintext is never stored, returned to the client, logged, or
  placed in an audit payload.
- **Access control:** `marketplace_credentials` RLS denies the `authenticated`
  and `anon` roles entirely (grants revoked + no policy); only trusted server
  code (service role) touches credentials → cross-tenant access is impossible.
- **Verification:** a connection reaches `connected` ONLY when a real
  `adapter.verifyConnection()` returns ok (`src/core/marketplace/verification.ts`).
  Mock connections verify without a credential; live connections require the
  stored (decrypted) credential and are never faked. Credential rotation resets
  verification. Sanitized status/errors.

## Takealot Adapter (established at Milestone 05)
- **First real marketplace adapter** (`src/integrations/takealot/`) implementing
  the generic `MarketplaceAdapter` contract over the **verified** Takealot
  Marketplace API (OpenAPI 3.1.1 at `marketplace-api.takealot.com/v1`; provenance
  in `docs/TAKEALOT_API.md`).
- **Auth:** `X-API-Key` header injected inside the transport only; server-side,
  never client-persisted, never logged/echoed (redacted defensively).
- **Pagination:** continuation-token semantics, exposed as the generic opaque
  cursor; each record yielded exactly once.
- **Money:** all amounts ZAR → canonical integer minor units (× 100).
- **Zod schemas** encoded only from verified fields; malformed payloads fail
  closed (quarantined). **Deterministic mapping** to canonical DTOs, incl. the
  verified `transaction_type` enum table, return-outcome and shipment-state
  maps; shipments expand to one canonical record per item.
- **Date-window splitter** for historical sync (contiguous, no gaps/overlap).
- **CI is network-free:** all tests use injected HTTP (mocked fetch). Live calls
  are deferred to the live-pilot milestone.

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
    marketplace/  Generic adapter contract, canonical DTOs, pagination, fixtures/manifest types
  integrations/   Marketplace adapters under integrations/<marketplace>/
    mock/         MockMarketplaceAdapter + synthetic fixtures & manifests
    takealot/     TakealotMarketplaceAdapter (verified schemas, transport, mapper)
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
