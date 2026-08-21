# RecoVault — Project State

## Current Status
- **Last GREEN milestone:** 13 — Recovery Verification & Mock-Validated MVP
- **MVP status:** COMPLETE (mock-validated). Milestones 01–13 GREEN.
- **Current allowed milestone:** 14 — Live Seller Pilot, but **BLOCKED** until authorized real seller credentials/permission exist.
- **Operating mode:** MOCK-FIRST (auth runs in MOCK mode; Supabase + Takealot live paths implemented but unverified)
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
- **Takealot adapter (M05):** first real adapter in `src/integrations/takealot/` — verified against the official Takealot Marketplace API (OpenAPI 3.1.1; provenance in `docs/TAKEALOT_API.md`). X-API-Key transport (server-only, redacted), continuation-token pagination, ZAR→minor-units money, Zod schemas from verified fields (fail-closed), deterministic mapping to canonical DTOs, date-window splitter. All tests network-free (injected fetch); live calls deferred to live pilot.
- **Secure marketplace connection (M06):** AES-256-GCM credential encryption (`src/core/security/crypto.ts`, env key, never in DB, server-only decrypt); `marketplace_credentials` table (migration 0003) with RLS denying all client roles; connection/verification services where `connected` is reached only via a real `adapter.verifyConnection()` (never faked); MOCK verifies without a credential; LIVE stores encrypted key and stays unverified until a real check; credential rotation; sanitized status. Plaintext never stored/returned/logged/audited.
- **Health route:** `GET /health` returns non-sensitive status.
- **Quality gate:** typecheck, lint, unit (Vitest 4 + RTL), integration (Vitest + PGlite), e2e (Playwright), build, and aggregate `check` scripts.
- **Module skeleton (empty until later milestones):** `src/integrations`, `src/recovery`.

No marketplace/recovery business functionality is implemented (per current scope). `marketplace_accounts` holds metadata only — no credentials.

## Active Recovery Rules
Deterministic, rule-based (no ML). Documented in `docs/RECOVERY_RULES.md`.
- **MR-001:v1** — Inbound Shipment Discrepancy (HIGH; quantity-based)
- **MR-002:v1** — Return Financial / Outcome Mismatch (MEDIUM; ambiguity-capped)
- **MR-003:v1** — Stock-Loss Event Without Matching Recovery (HIGH; reversal-aware)

## Database State
- **Schema migration version:** 0011 (`0001`–`0010` + `0011_least_privilege_grants.sql`)
- **Supabase schema:** DEFINED via migrations; applied and verified against a local
  real Supabase stack (Supabase CLI `db reset`, migrations 0001–0011 clean from zero).
  Migrations 0001–0010 also applied + verified on the hosted project
  `fxesioydpmkgbycqsmts` (schema/RLS/write-path GREEN); **0011 not yet pushed to hosted.**
- **RLS:** ENABLED + tested on all 16 tenant tables (deny cross-tenant by default)
- **Grants (explicit, deterministic across environments):**
  - `service_role` — the minimum per validated server workflow (migration 0010),
    with no DML on `marketplace_accounts` (migration 0011).
  - `authenticated` — exactly the 0002–0009 client matrix, pinned by migration
    0011 (core tenancy CRUD; `audit_events` SELECT+INSERT; all ingestion/ledger/
    candidate/case/recovery tables SELECT-only). RLS remains the row layer.
  - `anon` — **no** tenant-table DML (migration 0011).
  - `marketplace_credentials` — server-only (0003): anon/authenticated denied,
    service_role full DML.
  Migration 0011 uses explicit REVOKE+GRANT so effective privileges are
  independent of Supabase platform defaults (defense-in-depth beyond RLS).

## Module Status
- Authentication & Organization Boundary: IMPLEMENTED (M03) — mock-mode verified; Supabase live path unverified
- Marketplace Contract & Mock Adapter: IMPLEMENTED (M04) — generic contract + MockMarketplaceAdapter + 12 fixtures
- Takealot Adapter: IMPLEMENTED (M05) — contract-verified; live calls unverified until live pilot
- Secure Marketplace Connection: IMPLEMENTED (M06) — encrypted credentials, RLS-isolated, never-faked verification
- Ingestion & Source Records: IMPLEMENTED (M07) — idempotent sync, full provenance, quarantine, tenant-isolated
- Marketplace Ledger: IMPLEMENTED (M08) — deterministic normalizers, append-only idempotent events, source traceability, exact money
- Recovery Engine: IMPLEMENTED (M09) — MR-001/002/003 deterministic detectors, explainable candidates, idempotent
- Money Finder: IMPLEMENTED (M10) — cockpit UI (totals/list/filters/detail/evidence), candidate workflow, brand applied
- Case Engine: IMPLEMENTED (M11) — case state machine, idempotent creation, append-only audit, evidence traceability
- Evidence & Claim Tracking: IMPLEMENTED (M12) — deterministic evidence pack + PDF, manual claim submission, separate deadline clocks, no auto-submission
- Recovery Verification & Production Readiness: IMPLEMENTED (M13) — deterministic recovery matching, reversal-aware, recovered totals, hardening (security headers, error boundaries, sanitized logging, prod env validation), clean-clone runbook
- Service-role privilege portability: IMPLEMENTED (migration 0010) — explicit minimum `service_role` table grants proven against a local real Supabase stack (full ingestion→ledger→candidate→case→recovery write path; append-only preserved; RLS + cross-tenant isolation intact). Removes reliance on platform default grants. Not a milestone; schema-portability hardening only.
- Least-privilege grant hardening: IMPLEMENTED (migration 0011) — explicit REVOKE+GRANT pinning `anon` (no tenant-table DML), `authenticated` (exact 0002–0009 client matrix), and `service_role` (0010 matrix, minus platform-default DML on `marketplace_accounts`). Deterministic across local and hosted; RLS/policies/schema/logic unchanged. Verified locally (db reset 0001–0011 + runtime security proofs + offline regression test that simulates hosted platform defaults and proves 0011 strips them). Not a milestone; defense-in-depth hardening only. Hosted push pending.
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
- **Takealot live path unverified:** the adapter is contract-verified against the official OpenAPI spec (docs/TAKEALOT_API.md) and fully tested with mocked HTTP, but has not made live API calls (no API key). Live request/response validation is deferred to the live-pilot milestone. Minor mapping decisions (shipment sku from offer_id; return refund via linked transactions; return-outcome enum mapping) are documented there.
- **Dependency audit:** 3 transitive HIGH advisories remain (`postcss` and `sharp`, both pulled in by Next.js). Their only fix is a Next.js 16 major upgrade, which removes `next lint` and would force an ESLint-flat-config migration. Both are build-time-only and non-exploitable in the current surface (`postcss` processes only our own trusted CSS; `sharp` runs only under `next/image` optimization, which is unused). Next.js is pinned to the patched **15.5.23** (direct CVE-2025-66478 resolved). The Next.js 16 migration is deferred to a dedicated, human-approved upgrade task.

## Current Development Permission
Milestone 13 is GREEN — the mock-validated MVP (Milestones 01–13) is complete.

Milestone 14 (Live Seller Pilot) is **BLOCKED**: it requires a consenting real
seller / authorized Takealot API key, which does not exist yet. Do not begin
Milestone 14 until such access is provided AND explicitly authorized. The absence
of a seller does not diminish the completed mock-validated MVP.

## Next Allowed Action
Await either (a) explicit human instruction plus real-seller credentials to
begin the Milestone 14 live pilot, or (b) a separate authorized task (e.g. the
deferred Next.js 16 dependency upgrade, or a commercial visual-polish gate).

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
