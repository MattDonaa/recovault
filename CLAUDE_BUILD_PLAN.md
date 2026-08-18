# 00-claude.md — RecoVault Engineering Constitution

## ROLE
You are the principal system design engineer and implementation agent for this repository.

You are building a marketplace-agnostic revenue recovery SaaS. "RecoVault" is the current public brand, but public branding MUST NOT be used as a domain-model namespace. The internal product/domain namespace is `marketplace-recovery`.

The first marketplace adapter is Takealot. Takealot is an adapter, never the core domain.

## PRODUCT DEFINITION
The finished V1 is a multi-tenant full-stack SaaS web application whose backend:
1. ingests marketplace operational and financial data;
2. validates and preserves source records;
3. normalizes them into an immutable marketplace event ledger;
4. executes deterministic recovery rules;
5. creates evidence-backed recovery candidates;
6. supports investigation and claim-case workflow;
7. tracks submission/SLA dates;
8. reconciles subsequent marketplace transactions to verify recovery.

The dashboard is the cockpit. The ledger + deterministic recovery engine are the product.

## MVP VALIDATION TARGET
A user can:
- sign up and authenticate;
- create/join an organization;
- connect a marketplace account in MOCK mode;
- run deterministic fixture-based syncs;
- inspect source records and sync health;
- build a normalized event ledger;
- run exactly the approved recovery rules;
- see Money Finder candidates and potential recovery;
- investigate/dismiss/accept a candidate;
- create a case from an accepted candidate;
- generate a structured evidence pack;
- mark a case submitted and track deadlines;
- record/match a recovery transaction;
- see a case close as recovered.

Real seller credentials are NOT available during initial development. The system MUST therefore be fully testable with a contract-faithful mock adapter and deterministic fixtures.

## LOCKED STACK
- Next.js App Router
- TypeScript, strict mode
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Supabase PostgreSQL
- Supabase Auth
- SQL migrations + Row Level Security
- Zod at all external/data boundaries
- Vitest
- React Testing Library
- Playwright
- selective server-side/scheduled job mechanism; no premature microservices
- Vercel deployment target
- Sentry-ready observability boundary
- Git/GitHub

Do not replace the stack without an explicit human instruction.

## ARCHITECTURAL LAWS
1. MODULAR MONOLITH FIRST. No microservices.
2. MARKETPLACE AGNOSTIC CORE. Marketplace-specific code lives behind adapter interfaces.
3. SERVER-ONLY CREDENTIALS. Marketplace API secrets never enter client bundles, localStorage, browser-readable DB responses, fixtures, logs, screenshots, or Git.
4. RAW + NORMALIZED. Preserve validated source records and separately generate normalized events.
5. IDEMPOTENCY. Re-running the same sync cannot duplicate source records, ledger events, anomalies, cases, or recoveries.
6. DETERMINISTIC MONEY LOGIC. LLMs MUST NOT determine liability, anomaly existence, recovery amount, confidence, or claim eligibility.
7. EXPLAINABILITY. Every anomaly must link to the rule version, source records, calculation inputs, and resulting amount.
8. TENANT ISOLATION. Every tenant-owned row must be protected server-side and with RLS where applicable.
9. AUDITABILITY. Material state transitions are append-only auditable events.
10. FAIL CLOSED. Invalid external payloads are quarantined/rejected, never silently normalized.
11. MONEY AS DECIMAL/INTEGER MINOR UNITS. Never use binary floating point for financial calculations.
12. UTC STORAGE. Store timestamps in UTC; render local marketplace/user timezone at boundaries.
13. NO HIDDEN AUTO-ACTIONS. V1 does not autonomously submit marketplace claims.
14. BRAND IS CONFIGURATION. `RecoVault` belongs in presentation/config, not table names, package names, core interfaces, or marketplace domain objects.
15. NO NEXT-MILESTONE WORK. Do not implement future milestone functionality early.

## MARKETPLACE ADAPTER CONTRACT
Core code may depend only on a generic interface such as:
- verifyConnection()
- listSeller/merchant metadata where supported
- listOffers()
- listSales()
- listReturns()
- listShipments()
- listTransactions()
- listBalances() where supported

Marketplace-specific response schemas, pagination, rate/error handling, identifiers and authentication remain inside `src/integrations/<marketplace>/`.

Implement:
- `MockMarketplaceAdapter` first.
- `TakealotMarketplaceAdapter` contract shell/real implementation only in its assigned milestone.
- identical normalized contracts downstream.

The official Takealot API currently documents API-key auth via `X-API-Key`, continuation-token pagination, and seller-specific endpoints including offers, sales, returns, shipments, transactions and balances. The implementation MUST be based on captured/verified official schemas, not guesses.

## MOCK DATA LAW
Fixtures must be synthetic. Never imply mock records came from a real seller.
Fixture scenarios must include:
- healthy/no-loss control;
- shipment discrepancy;
- resolved shipment;
- return with consistent outcome/transactions;
- return mismatch;
- stock-loss event with matching payment;
- stock-loss event without matching payment;
- reversal after payment;
- duplicate pages/retry;
- malformed external payload;
- empty account;
- large paginated account.

Every fixture has a human-readable scenario manifest containing expected detector outputs.

## INITIAL RECOVERY RULES
Only these detector families are permitted for the MVP until explicitly expanded:

### MR-001 Inbound Shipment Discrepancy
Candidate only when the configured rule's required shipment evidence is complete.
Core quantity concept:
unaccounted = quantity_sending - quantity_received - quantity_damaged - other explicitly accounted quantities
Never infer missing fields as zero unless the marketplace contract defines them as zero.

### MR-002 Return Financial/Outcome Mismatch
Detect only explicitly defined contradictions between return outcome state and expected linked financial/inventory events. Exact predicates must be documented and tested before activation. Ambiguous cases are `needs_review`, not claims.

### MR-003 Stock-Loss Event Without Matching Recovery
Detect a verified stock-loss/loss-reference event for which no matching recovery/payment exists inside the defined reconciliation window and matching rules.

A reversal may reopen/downgrade a previously recovered candidate if explicitly matched.

## CANDIDATE LANGUAGE
Before human verification, UI/API language MUST say:
- "potential recovery"
- "recovery candidate"
- "anomaly"
Never: "marketplace owes you", "guaranteed claim", or equivalent.

## CONFIDENCE
V1 confidence is deterministic and rule-based. No ML.
Each rule documents:
- evidence requirements;
- disqualifiers;
- scoring factors;
- score calculation;
- HIGH/MEDIUM/LOW thresholds.
Only HIGH candidates should be prominent by default.

## STATE MACHINES
Recovery candidate:
`detected -> investigating -> accepted | dismissed`

Case:
`draft -> evidence_ready -> submitted -> under_review -> accepted | disputed -> payment_expected -> recovered | closed`

Invalid transitions MUST fail server-side and be tested.

## SECURITY BASELINE
- strict env validation;
- no secrets committed;
- no secret values in logs;
- API credentials encrypted at rest before DB persistence;
- server-only decryption;
- RLS tenant boundaries;
- CSRF-safe patterns where applicable;
- authorization checks independent of UI;
- sanitized error responses;
- rate limiting boundary prepared for sensitive endpoints;
- dependency audit recorded at gates;
- secure headers appropriate to deployment;
- test for cross-tenant access denial.

## REQUIRED QUALITY COMMANDS
Create stable package scripts so gates can execute:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`
- `npm run check` (aggregates required non-E2E checks)

No milestone may be marked GREEN if a required command is absent, skipped without documented human approval, flaky, or failing.

## GREEN-GATE PROTOCOL
For EVERY milestone:

### Before coding
1. Read this file.
2. Read only the current milestone plus any explicitly referenced completed docs.
3. Run the previous milestone's verification commands.
4. Inspect `docs/PROJECT_STATE.md`.
5. State:
   - CURRENT MILESTONE
   - VERIFIED CURRENT STATE
   - IN-SCOPE WORK
   - EXPLICITLY OUT OF SCOPE
   - TESTS THAT WILL PROVE COMPLETION
6. If previous gate is not GREEN: STOP. Repair previous milestone only.

### During coding
- implement smallest compliant increment;
- add/modify tests with behavior;
- do not suppress errors with `any`, blanket eslint disables, test skips, or catch-and-ignore;
- no TODO that is required for the current acceptance criteria;
- no fake success UI disconnected from real current-layer behavior.

### Gate
Run every command required by the milestone.
Perform stated manual acceptance checks.
Review git diff for secrets and scope creep.
Produce a GATE REPORT.

### Gate report format
```
MILESTONE: NN — <name>
STATUS: GREEN | RED

AUTOMATED
[GREEN/RED] typecheck
[GREEN/RED] lint
[GREEN/RED] unit tests
[GREEN/RED] integration tests
[GREEN/RED] e2e (if required)
[GREEN/RED] production build

SECURITY
[GREEN/RED] tenant isolation
[GREEN/RED] secret scan
[GREEN/RED] milestone-specific checks

ACCEPTANCE
[GREEN/RED] AC-...
...

CHANGED FILES
- ...

KNOWN NON-BLOCKING ITEMS
- ...

BLOCKERS
- ...

NEXT MILESTONE
- NN+1 only if STATUS=GREEN
```

### STOP RULE
If any required check is RED:
- do not proceed;
- identify root cause;
- fix only current/prior milestone scope;
- rerun the complete gate;
- never relabel RED as acceptable.

## PROJECT STATE
Maintain `docs/PROJECT_STATE.md` after each GREEN milestone:
- last green milestone;
- schema migration version;
- implemented modules;
- active rules and versions;
- known non-blocking limitations;
- mock/live mode status;
- next allowed milestone.
This file is factual state, not a roadmap.

## MIGRATION LAW
- schema changes only through committed migrations;
- never edit production schema manually as the source of truth;
- migrations must be repeatable on a clean environment;
- destructive migrations require explicit human approval;
- RLS/policies ship with tenant tables, not later.

## SOURCE RECORD LAW
For external records store enough metadata to prove provenance:
- marketplace account;
- external record type/id;
- source timestamp where available;
- ingestion timestamp;
- schema version;
- payload hash;
- validated raw payload or safely retained equivalent;
- sync job id.

Never mutate historical raw source content to "fix" normalization.

## LEDGER LAW
`marketplace_events` is append-oriented and normalized.
Every event includes:
- tenant/account;
- event type;
- marketplace;
- canonical entity references;
- quantity/amount where applicable;
- occurred_at;
- source-record reference(s);
- normalizer version;
- deterministic event key.

## OBSERVABILITY
Every sync job records:
- status;
- start/end;
- adapter;
- pages fetched;
- records fetched/inserted/updated/rejected;
- cursor/checkpoint;
- sanitized error code/message.
No credentials or unnecessary sensitive payloads in logs.

## NO-SELLER STRATEGY
Until a real consenting seller is available:
- all integration tests use mock/fixture mode;
- UI clearly labels mock/demo data;
- no claims about real recoveries;
- live adapter tests that require credentials are marked as `requires-live-credentials` and are NOT part of GREEN until the live-validation milestone;
- unit/contract tests for the real adapter remain mandatory without secrets.

## DEFINITION OF MVP COMPLETE
MVP is complete only when:
1. Milestones 01–13 are GREEN.
2. End-to-end mock scenario proves ingestion -> ledger -> anomaly -> case -> evidence -> submission tracking -> recovery matching.
3. Cross-tenant isolation tests pass.
4. A clean clone can be configured and run from documentation.
5. Production build passes.
6. No real-seller claims are made.

Milestone 14 is LIVE PILOT VALIDATION and remains intentionally BLOCKED until a consenting real seller/API key exists. The absence of a seller does NOT prevent completion of the mock-validated MVP.

## EXECUTION ORDER
Execute milestone files strictly numerically. Never skip.


---

# Milestone 01 — Repository & Quality Foundation
## Objective
Create the runnable modular-monolith skeleton and quality gate. No product features.
## Build
- Next.js App Router + strict TypeScript.
- Tailwind; shadcn/ui initialized; Lucide available.
- canonical folders: `src/app`, `src/components`, `src/core`, `src/integrations`, `src/recovery`, `src/lib`, `tests`.
- env schema with Zod; `.env.example` contains names only.
- package scripts required by 00-claude.md.
- Vitest, RTL, Playwright installed/configured.
- health page/route only.
- `docs/PROJECT_STATE.md`, `docs/ARCHITECTURE.md`.
## Tests
- trivial unit test proves runner.
- health route/page smoke test.
- Playwright smoke loads app.
## Explicitly out of scope
Auth, Supabase schema, marketplace data, dashboard, rules.
## Acceptance
- AC-01 clean install succeeds.
- AC-02 typecheck/lint/unit/build GREEN.
- AC-03 E2E smoke GREEN.
- AC-04 secret scan finds no credential.
- AC-05 architecture documents marketplace-agnostic modular monolith.


---

# Milestone 02 — Database, Tenancy & RLS
## Objective
Create the persistent multi-tenant foundation before auth UI or marketplace features.
## Build
- Supabase local/dev configuration and migrations.
- tables: organizations, organization_members, marketplace_accounts (metadata only), audit_events.
- UUID PKs, created/updated timestamps, constraints/indexes.
- tenant ownership model.
- RLS policies denying cross-organization access.
- generated/typed DB boundary.
## Tests
- migration applies to clean DB.
- tenant A cannot read/update/delete tenant B rows.
- unauthenticated access denied where required.
- duplicate memberships/invalid roles constrained.
## Out of scope
Marketplace credentials, source records, sync, auth screens.
## Acceptance
AC-01 clean migrations GREEN.
AC-02 RLS integration tests GREEN.
AC-03 no table named after RecoVault or Takealot in core domain.


---

# Milestone 03 — Authentication & Organization Boundary
## Objective
A user can authenticate and operate only inside an authorized organization.
## Build
- Supabase Auth email/password.
- signup/login/logout.
- protected app shell.
- organization creation/bootstrap.
- server-side authorization helper used independently of UI.
- minimal navigation shell; no fake recovery metrics.
## Tests
- protected route redirects/rejects unauthenticated user.
- user A cannot access organization B by URL/API mutation.
- logout invalidates protected access.
## Out of scope
Marketplace connection and Money Finder.
## Acceptance
AC-01 auth E2E GREEN.
AC-02 cross-tenant authorization GREEN.
AC-03 no privileged service key exposed to browser bundle.


---

# Milestone 04 — Marketplace Contract & Mock Adapter
## Objective
Prove the marketplace-agnostic integration boundary without real credentials.
## Build
- generic `MarketplaceAdapter` interfaces and canonical DTOs.
- `MockMarketplaceAdapter`.
- synthetic fixture library + scenario manifests.
- pagination abstraction.
- Zod validation at adapter output boundary.
- demo/mock marketplace account creation clearly labeled MOCK.
## Required scenarios
healthy, shipment discrepancy, resolved shipment, return-consistent, return-mismatch, stock-loss-paid, stock-loss-unpaid, reversal, duplicate/retry, malformed, empty, paginated-large.
## Tests
- contract test suite runs against mock adapter.
- malformed fixture fails closed.
- pagination yields each source record exactly once.
## Out of scope
Takealot network calls, persistence of source records, recovery rules.
## Acceptance
AC-01 adapter contract tests GREEN.
AC-02 fixture expected-results manifests validate.
AC-03 no marketplace-specific types leak into core.


---

# Milestone 05 — Takealot Adapter (Contract-Verified, No Live Credential Required)
## Objective
Implement the first real marketplace adapter behind the generic contract, while keeping runtime testing in mock mode.
## Build
- `src/integrations/takealot/` client, schemas, mapper, pagination, sanitized errors.
- endpoints/contracts for seller metadata, offers, sales, returns, shipments, transactions, balances as needed by the generic contract.
- `X-API-Key` injected server-side only.
- continuation-token behavior modeled correctly.
- transaction date-window helper respecting documented maximum range.
- HTTP transport injectable so contract tests use captured synthetic responses.
## Tests
- official-schema-shaped synthetic responses validate/map.
- 403 sanitized.
- 404 where applicable handled.
- pagination continuation token works and does not reuse ignored filters.
- API key never appears in error/log snapshot.
## Out of scope
Storing a real API key, live calls, sync persistence.
## Acceptance
AC-01 Takealot adapter passes generic contract suite with mocked HTTP.
AC-02 zero network dependency in CI.
AC-03 secret leakage tests GREEN.


---

# Milestone 06 — Secure Marketplace Connection
## Objective
Persist marketplace connections safely and support MOCK now / LIVE later.
## Build
- marketplace_accounts connection mode: MOCK | LIVE.
- encrypted credential record separated from account metadata.
- server-only encryption/decryption service using environment-held key.
- connection verification service.
- UI to add mock account; live form may exist but must clearly require credentials and cannot fake verification.
- credential rotation/replacement path.
## Tests
- encrypted DB value differs from plaintext.
- client/API responses never return credential.
- logs never include credential.
- wrong tenant cannot access connection.
- mock account verifies without secret.
## Out of scope
Historical sync.
## Acceptance
AC-01 credential security tests GREEN.
AC-02 mock connection E2E GREEN.
AC-03 LIVE remains unverified until Milestone 14.


---

# Milestone 07 — Idempotent Ingestion & Source Records
## Objective
Ingest mock marketplace datasets reliably and preserve provenance.
## Build
- sync_jobs, source_records, sync checkpoints.
- fetch adapter collections; validate; persist raw validated records.
- deterministic external keys + payload hashes.
- idempotent upsert policy.
- rejected/quarantined record handling.
- retry-safe job status and sanitized diagnostics.
## Tests
- first sync inserts expected records.
- second identical sync creates zero duplicates.
- changed source payload is versioned/updated per documented policy without erasing provenance.
- malformed payload quarantined.
- paginated-large fixture completes.
- interrupted/retried job remains consistent.
## Out of scope
Ledger normalization, anomalies.
## Acceptance
AC-01 idempotency GREEN.
AC-02 provenance fields complete.
AC-03 sync activity accurately reports counts.


---

# Milestone 08 — Normalized Marketplace Ledger
## Objective
Convert source records into marketplace-independent immutable events.
## Build
- marketplace_events table.
- normalizers for shipment, return/outcome, transaction/payment and sale events needed by MVP.
- deterministic event keys and normalizer versions.
- canonical identifiers/references.
- financial amounts stored safely (minor units or exact numeric).
- rebuild-from-source command for test/dev.
## Tests
- same source => same event key.
- rerun => no duplicate events.
- source record traceability from every event.
- exact monetary calculations.
- mock scenarios normalize to documented expected event sets.
## Out of scope
Recovery detection.
## Acceptance
AC-01 ledger scenario snapshots GREEN.
AC-02 provenance traversal GREEN.
AC-03 no marketplace-specific enum required by recovery core without canonical mapping.


---

# Milestone 09 — Deterministic Recovery Engine
## Objective
Implement MR-001, MR-002, MR-003 as versioned deterministic detectors.
## Build
- recovery rule interface + registry.
- rule versioning.
- anomaly/recovery_candidates persistence.
- evidence references and calculation inputs.
- deterministic confidence score.
- exact rule specifications in `docs/RECOVERY_RULES.md`.
- rules must be independently runnable and idempotent.
## Required rules
MR-001 inbound shipment discrepancy.
MR-002 explicitly specified return outcome/financial mismatch.
MR-003 verified stock-loss event without matching recovery.
## Tests
For every rule:
- positive case;
- healthy negative;
- boundary case;
- missing evidence => no high-confidence candidate;
- duplicate execution => no duplicate candidate;
- amount calculation exact;
- rule version recorded.
## Out of scope
AI, case creation, PDF, auto submission.
## Acceptance
AC-01 all rule truth tables GREEN.
AC-02 healthy fixture yields zero false positives.
AC-03 expected scenario manifest matches exact candidates/amounts.


---

# Milestone 10 — Money Finder
## Objective
Expose recovery candidates clearly without overstating liability.
## Build
- overview totals derived from persisted candidates.
- Money Finder list/filter/detail.
- candidate evidence, source trace, rule/version, amount, confidence.
- states: detected, investigating, accepted, dismissed.
- authorized server-side transitions.
- MOCK banner on all demo-derived financial screens.
## Tests
- totals equal underlying candidate amounts.
- dismiss removes candidate from actionable totals but preserves audit history.
- accepted candidate cannot be silently mutated.
- forbidden state transitions rejected.
- cross-tenant candidate access denied.
## Out of scope
Case/evidence pack.
## Acceptance
AC-01 E2E mock scan -> Money Finder GREEN.
AC-02 UI uses "potential recovery"/candidate language.
AC-03 no hard-coded Takealot branding in core screens except marketplace source labels.


---

# Milestone 11 — Case Engine & Audit Trail
## Objective
Turn accepted candidates into controlled recovery cases.
## Build
- cases, case_events, case_evidence_refs.
- one case per accepted candidate unless explicit supported grouping exists (do not add grouping in MVP).
- state machine from 00-claude.md.
- immutable audit events for material transitions.
- case detail timeline.
## Tests
- only accepted candidate creates case.
- duplicate create request is idempotent.
- invalid transition rejected.
- every transition has actor/time/from/to.
- candidate evidence remains traceable.
## Out of scope
PDF and marketplace submission.
## Acceptance
AC-01 state-machine tests GREEN.
AC-02 audit integrity GREEN.
AC-03 cross-tenant case isolation GREEN.


---

# Milestone 12 — Evidence Pack & Claim Tracking
## Objective
Generate factual evidence and track manually submitted disputes.
## Build
- deterministic structured evidence model.
- server-generated printable/PDF evidence pack.
- calculations sourced from stored rule inputs; never recalculated by free-form AI.
- seller can mark submitted and enter external ticket/reference + submission date.
- separate deadline concepts/configuration; do not conflate claim-submission deadlines with dispute-resolution SLAs.
- countdown/status derived from explicit policy configuration, not hard-coded legal assertions.
## Tests
- evidence pack values match case/source data.
- no unsupported claim language.
- submission requires reference/date as defined.
- deadline calculation boundary tests.
- PDF/print generation smoke.
## Out of scope
Automatic marketplace claim submission; LLM narratives.
## Acceptance
AC-01 evidence pack deterministic snapshot GREEN.
AC-02 submitted case audit event GREEN.
AC-03 no auto-submission code exists.


---

# Milestone 13 — Recovery Matching, End-to-End MVP & Production Hardening
## Objective
Close the loop and prove the complete mock-validated MVP.
## Build
- recovery_records and deterministic matching service.
- match qualifying marketplace recovery/payment events to cases using documented identifiers/windows.
- reversal handling.
- recovered totals and case closure.
- production env validation, security headers, error boundary, sanitized logging, observability interface.
- deployment docs and clean-clone runbook.
## End-to-end golden scenario
Mock connect -> sync -> source records -> ledger -> MR detector -> candidate -> accept -> case -> evidence -> mark submitted -> ingest matching recovery -> case recovered -> dashboard total updated.
## Tests
- golden E2E.
- unmatched payment does not close case.
- ambiguous match requires review.
- reversal updates state according to documented rule.
- tenant isolation full regression.
- clean build.
## Acceptance
AC-01 ALL package quality commands GREEN.
AC-02 golden E2E GREEN.
AC-03 mock MVP can be demonstrated without real seller.
AC-04 security regression GREEN.
AC-05 clean clone/runbook verified.
At GREEN, mock-validated MVP is complete. Do not pretend live Takealot validation is complete.


---

# Milestone 14 — Live Seller Pilot Validation (BLOCKED UNTIL CREDENTIALS EXIST)
## Entry condition
A consenting real seller supplies authorized marketplace API access and pilot permission. Until then this milestone MUST remain BLOCKED, not RED.
## Objective
Validate adapter assumptions and recovery precision against real data without changing core rules opportunistically.
## Procedure
1. Confirm written/recorded pilot authorization and data-handling boundaries.
2. Configure LIVE account through secure credential flow.
3. Verify connection server-side.
4. Run limited read-only sync.
5. Compare counts/samples against seller-visible marketplace records.
6. Expand historical sync gradually.
7. Run detectors.
8. Human-review every HIGH candidate before any claim action.
9. Measure precision, amount, false-positive reasons, missing-data cases.
10. Never auto-submit.
## Required pilot metrics
- ingestion success/error rate;
- schema validation failures;
- duplicate rate;
- detector precision by rule;
- number/value of candidates;
- human-confirmed candidate rate;
- eventual recovery outcomes where available.
## Gate
GREEN only after live adapter behavior is verified and a documented pilot report is accepted by the human owner.
## Out of scope
Public launch, billing, automated claims, new detector families.


---

# Milestone 15 — Commercial Release Gate
## Entry condition
Milestone 14 GREEN and explicit human instruction to prepare commercial release.
## Objective
Convert validated MVP into release candidate without expanding product scope.
## Required work
- production data retention/privacy/security review;
- onboarding copy grounded in validated behavior;
- backups/recovery procedures;
- operational alerts;
- support/admin runbook;
- legal/terms/privacy inputs flagged for qualified review;
- billing only if explicitly authorized;
- production smoke and rollback plan.
## Gate
No public launch if live recovery precision, security, backup/restore, tenant isolation, or operational runbook is RED.
